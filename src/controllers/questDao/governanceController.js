const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToPublicKey, convertToBN } = require('../../utils/solanaHelpers');
const { handleSolanaError } = require('../../utils/solanaErrorHandler');
const { checkAccountBalance } = require('../../utils/solanaAccountHelpers');
const { formatSol } = require('../../utils/solanaAmountHelpers');
const solanaTxService = require('../../services/solanaTxService');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const InvalidQuestStatus = require('../../exceptions/quest/InvalidQuestStatus');
const QuestPending = require('../../exceptions/quest/QuestPending');
const ContractInteractionError = require('../../exceptions/ContractInteractionError');
const BaseQuestDaoController = require('./baseController');

const governanceNftActions = require('../../database/governanceNftActions');

const governanceController = {
  getGovernanceNftsByOwner: async (req, res) => {
    try {
      const { wallet } = req.query;
      
      if (!wallet) {
        return res.status(400).json(err(new Error('wallet parameter is required')));
      }

      const governanceSDK = getGovernanceSDK();
      const [collectionMint] = governanceSDK.getCollectionMintPDA();
      const collectionAddress = collectionMint.toBase58();

      const nfts = await governanceNftActions.getByOwner(wallet, collectionAddress);

      return res.status(200).json(success({
        wallet,
        collectionAddress,
        nfts,
        count: nfts.length,
      }));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message || 'Unknown error occurred';
      return res.status(500).json(err(new Error(errorMessage)));
    }
  },

  createGovernanceItem: async (req, res) => {
    const { quest_key } = req.params;
    const { creatorNftAccount } = req.body;
    let quest;

    try {
      quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);
      if (quest.quest_status !== 'DRAFT') {
        throw new InvalidQuestStatus('Quest must be in DRAFT status to create governance item');
      }
      if (quest.quest_pending === true) throw new QuestPending();
      
      if (!quest.quest_creator) {
        throw new ContractInteractionError('Quest creator is required. Quest must have quest_creator field.');
      }
      
      if (!creatorNftAccount) {
        throw new ContractInteractionError('creatorNftAccount is required. Creator must have NFT from governance collection.');
      }
      
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message || 'Unknown error occurred';
      const errorObj = e instanceof Error ? e : new Error(errorMessage);
      return res.status(400).json(err(errorObj));
    }

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const creatorPubkey = convertToPublicKey(quest.quest_creator);
      const nftAccounts = Array.isArray(creatorNftAccount) 
        ? creatorNftAccount.map(acc => convertToPublicKey(acc))
        : [convertToPublicKey(creatorNftAccount)];
      
      for (const nftAccount of nftAccounts) {
        let accountExists = false;
        for (let retry = 0; retry < 5; retry++) {
          try {
            const accountInfo = await governanceSDK.connection.getAccountInfo(nftAccount, 'confirmed');
            if (accountInfo) {
              accountExists = true;
              break;
            }
          } catch (e) {
          }
          if (retry < 4) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        if (!accountExists) {
          throw new ContractInteractionError(`NFT account ${nftAccount.toString()} does not exist or is not yet available`);
        }
      }
      
      const adminKp = solanaTxService.getAdminKeypair();
      const minBalance = 3e6;
      const balanceInfo = await checkAccountBalance(governanceSDK.connection, adminKp.publicKey, minBalance);
      
      if (!balanceInfo.sufficient) {
        throw new ContractInteractionError(
          `Admin wallet insufficient balance: ${balanceInfo.balanceFormatted}, need ${formatSol(minBalance)}`
        );
      }
      
      const { blockhash: bh2, lastValidBlockHeight: lvh2 } = await governanceSDK.connection.getLatestBlockhash('confirmed');
      const nftAccountsForTx = nftAccounts.length === 1 ? nftAccounts[0] : nftAccounts;
      const txCreate = await governanceSDK.createGovernanceItem(
        questKeyBN, 
        quest.quest_title || `Quest ${quest_key}`,
        nftAccountsForTx, 
        creatorPubkey
      );
      txCreate.feePayer = creatorPubkey;
      txCreate.recentBlockhash = bh2;

      const txBase64 = txCreate.serialize({ requireAllSignatures: false }).toString('base64');

      return res.status(200).json(success({
        transactionBase64: txBase64,
        recentBlockhash: bh2,
        lastValidBlockHeight: lvh2,
      }, 'Transaction created - please sign and submit on client'));
    } catch (e) {
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message || 'Unknown error occurred';
      return res.status(400).json(err(new ContractInteractionError(`Failed to create governance_item: ${errorMessage}`)));
    }
  },
};

module.exports = governanceController;

