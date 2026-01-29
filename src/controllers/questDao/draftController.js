const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const models = require('../../models/mysql');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const { BN } = require('@coral-xyz/anchor');
const { handleSolanaError } = require('../../utils/solanaErrorHandler');
const { ensureAdminBalance, sendErrorResponse } = require('../../utils/controllerHelpers');
const solanaTxService = require('../../services/solanaTxService');
const validateTransactionHash = require('../../validates/txHash');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const ContractInteractionError = require('../../exceptions/ContractInteractionError');
const BaseQuestDaoController = require('./baseController');

const draftController = {
  startDraft: async (req, res) => {
    try {
      const { tx, start_at, end_at } = req.body;
      const { quest_key } = req.params;
      validateTransactionHash(tx);
      const updateInfo = { tx, start_at, end_at };
      await client.GovernanceItem.UpdateDraftTime(quest_key, updateInfo);

      res.status(200).json(success('', 'Draft time updated!'));
    } catch (e) {
      return sendErrorResponse(e, res);
    }
  },

  setDraftResult: async (req, res) => {
    const { quest_key } = req.params;
    try {
      const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);
      
      let daoDraftTx = null;

      try {
        const governanceSDK = getGovernanceSDK();
        const questKeyBN = convertToBN(quest_key);
        const item = await governanceSDK.fetchGovernanceItem(questKeyBN);
        
        if (item) {
          const result = item.questResult || item.quest_result;
          const questEndTime = item.questEndTime?.toNumber?.() || item.quest_end_time?.toNumber?.() || 0;
          const questStartTime = item.questStartTime?.toNumber?.() || item.quest_start_time?.toNumber?.() || 0;

          let approved = false;
          let resultStatus = 'unknown';
          
          if (typeof result === 'number') {
            approved = result === 1;
            resultStatus = approved ? 'approved' : 'rejected';
          } else if (result && typeof result === 'object') {
            if (result.approved !== undefined) {
              approved = true;
              resultStatus = 'approved';
            } else if (result.pending !== undefined) {
              approved = false;
              resultStatus = 'pending';
            } else if (result.rejected !== undefined) {
              approved = false;
              resultStatus = 'rejected';
            }
          }
          
          if (!approved) {
            if (resultStatus === 'pending') {
              try {
                // Set end_time to past (start_time + 1) to skip waiting
                const startTime = questStartTime || 1;
                const pastEndTime = new BN(startTime + 1);

                const adminKp = solanaTxService.getAdminKeypair();
                const tx = await governanceSDK.setQuestEndTime(questKeyBN, pastEndTime, adminKp.publicKey);
                const { blockhash } = await governanceSDK.connection.getLatestBlockhash('confirmed');
                tx.recentBlockhash = blockhash;
                tx.feePayer = adminKp.publicKey;
                tx.sign(adminKp);
                await solanaTxService.sendAndConfirm(tx, [adminKp]);

                await client.QuestDao.UpdateData(quest_key, { dao_draft_end_at: new Date() });

                try {
                  await client.QuestDao.OnPending(quest_key);
                } catch (_) {}

                const questVotePDA = governanceSDK.getQuestVotePDA(questKeyBN)[0];
                const qv = await governanceSDK.program.account.questVote.fetch(questVotePDA);
                const approver = qv.countApprover?.toNumber?.() || qv.count_approver || 0;
                const rejector = qv.countRejector?.toNumber?.() || qv.count_rejector || 0;

                let receipt;
                if (approver === rejector) {
                  receipt = await solanaTxService.makeQuestResult(quest_key);
                } else {
                  receipt = await solanaTxService.setQuestResult(quest_key);
                }

                daoDraftTx = receipt.transactionHash;

                const updatedItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
                const updatedResult = updatedItem?.questResult || updatedItem?.quest_result;

                if (updatedResult) {
                  const isNowApproved = typeof updatedResult === 'number'
                    ? (updatedResult === 1)
                    : (updatedResult.approved !== undefined);

                  if (isNowApproved) {
                    approved = true;
                  } else {
                    try {
                      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
                    } catch (_) {}
                    return res.status(400).json(err(new ContractInteractionError(
                      'Failed to approve quest result on-chain. Please try make draft result (PATCH /draft/make) first.'
                    )));
                  }
                }
              } catch (makeErr) {
                try {
                  await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
                } catch (_) {}
                const errorInfo = handleSolanaError(makeErr);
                return res.status(400).json(err(new ContractInteractionError(
                  `Failed to auto-approve quest result: ${errorInfo.message || makeErr.message}. Please try make draft result (PATCH /draft/make) first.`
                )));
              }
            } else {
              return res.status(400).json(err(new ContractInteractionError(
                'Quest result is rejected on-chain. Cannot set draft result for rejected quest.'
              )));
            }
          }
          
          if (!approved) {
            return res.status(400).json(err(new ContractInteractionError(
              'Quest result is not approved on-chain. Please use make draft result (PATCH /draft/make) to approve on-chain first.'
            )));
          }
        }
      } catch (onChainError) {
        console.error(`[setDraftResult] Could not verify on-chain status for quest ${quest_key}:`, onChainError.message);
      }
      
      const updateData = {
        quest_status: 'APPROVE',
        quest_pending: false,
      };
      if (daoDraftTx) {
        updateData.dao_draft_tx = daoDraftTx;
      }
      
      await client.QuestDao.UpdateStatus(quest_key, updateData);
      
      const updatedQuest = await models.quests.findOne({ 
        where: { quest_key },
        attributes: ['quest_key', 'quest_status', 'quest_pending']
      });
      
      if (!updatedQuest || updatedQuest.quest_status !== 'APPROVE') {
        throw new Error('Failed to update quest status to APPROVE');
      }
      
      if (updatedQuest.quest_pending === true) {
        try {
          await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
        } catch (_) {}
      }
      
      return res.status(200).json(success('', 'APPROVE'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      const code = e?.statusCode || 400;
      return res.status(code).json(err(errorMessage));
    }
  },

  makeDraftResult: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;
    
    try {
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      return res.status(400).json(err(e));
    }

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      try {
        const questVote = await governanceSDK.fetchQuestVote(questKeyBN);
        const alreadyFinalized = Boolean(questVote?.finalized);
        if (alreadyFinalized) {
          await client.QuestDao.UpdateStatus(quest_key, {
            quest_status: 'APPROVE',
            quest_pending: false,
          });
          return res.status(200).json(success('', 'APPROVE'));
        }
      } catch (_) {}
      
      const questVotePDA = governanceSDK.getQuestVotePDA(questKeyBN)[0];
      const qv = await governanceSDK.program.account.questVote.fetch(questVotePDA);
      const approver = qv.countApprover?.toNumber?.() || qv.count_approver || 0;
      const rejector = qv.countRejector?.toNumber?.() || qv.count_rejector || 0;

      if (approver === rejector) {
        receipt = await solanaTxService.makeQuestResult(quest_key);
      } else {
        receipt = await solanaTxService.setQuestResult(quest_key);
      }
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      console.error('[makeDraftResult] Error:', {
        name: errorInfo?.name,
        code: errorInfo?.code || errorInfo?.number,
        message: errorInfo?.message || e?.message,
        logs: errorInfo?.logs,
      });
      
      if (e.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          await client.QuestDao.UpdateData(quest_key, { dao_draft_tx: e.transactionHash || errorInfo.originalError?.transactionHash });
        } catch (dbError) {
          console.warn('Failed to update DB after transaction timeout:', quest_key);
        }
        return res.status(202).json(success('', 'Pending'));
      }
      
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      
      const errorMessage = (process.env.NODE_ENV === 'dev' && errorInfo?.logs)
        ? `${errorInfo.message || e.message}\nLOGS:${JSON.stringify(errorInfo.logs, null, 2)}`
        : (errorInfo.message || errorInfo.originalError?.message || e.message || 'Unknown error');
      return res.status(400).json(err(new ContractInteractionError(errorMessage)));
    }

    try {
      const updateData = {
        quest_status: 'APPROVE',
        quest_pending: false,
        dao_draft_tx: receipt.transactionHash,
      };
      
      await client.QuestDao.UpdateStatus(quest_key, updateData);
      
      const updatedQuest = await models.quests.findOne({ 
        where: { quest_key },
        attributes: ['quest_key', 'quest_status', 'dao_draft_tx']
      });
      
      if (!updatedQuest || updatedQuest.quest_status !== 'APPROVE') {
        if (updatedQuest && updatedQuest.quest_status !== 'APPROVE') {
          await client.QuestDao.UpdateStatus(quest_key, updateData);
          const retryQuest = await models.quests.findOne({ 
            where: { quest_key },
            attributes: ['quest_key', 'quest_status']
          });
          if (retryQuest && retryQuest.quest_status !== 'APPROVE') {
            throw new Error(`Failed to update quest status to APPROVE. Current status: ${retryQuest.quest_status}`);
          }
        } else {
          throw new Error('Quest not found after update');
        }
      }
      
      return res.status(200).json(success('', 'APPROVE'));
    } catch (e) {
      try {
        await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      } catch (_) {}
      return res.status(500).json(err('Transaction success but DB Update Failed'));
    }
  },

  EndDraftTime: async (req, res) => {
    const { quest_key } = req.params;

    try {
      const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const item = await governanceSDK.fetchGovernanceItem(questKeyBN);
      if (!item || !(item.questKey || item.quest_key)) {
        const [governanceItemPda] = governanceSDK.getGovernanceItemPDA(questKeyBN);
        return res.status(400).json(
          err(
            new ContractInteractionError('Governance item does not exist. Please create governance item first.'),
            { pda: governanceItemPda.toBase58(), questKey: String(quest_key) },
          ),
        );
      }

      // Set end_time to past (start_time + 1) to end immediately
      const startTime = item.questStartTime?.toNumber?.() || item.quest_start_time?.toNumber?.() || 1;
      const endTimeBN = new BN(startTime + 1);

      await ensureAdminBalance(2e6);
      const adminKp = solanaTxService.getAdminKeypair();

      try {
        const tx = await governanceSDK.setQuestEndTime(questKeyBN, endTimeBN, adminKp.publicKey);
        const { blockhash } = await governanceSDK.connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = adminKp.publicKey;
        tx.sign(adminKp);
        await solanaTxService.sendAndConfirm(tx, [adminKp]);
      } catch (e) {
        const errorInfo = handleSolanaError(e);
        const errorMessage = errorInfo.message || errorInfo.originalError?.message || e.message || 'Unknown error';
        return res.status(400).json(err(new ContractInteractionError(errorMessage)));
      }

      await client.QuestDao.UpdateData(quest_key, { dao_draft_end_at: new Date() });
      return res.status(200).json(success('', 'Draft End time updated'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      console.error('[EndDraftTime] Error:', {
        name: errorInfo?.name,
        code: errorInfo?.code || errorInfo?.number,
        message: errorInfo?.message || e?.message,
        logs: errorInfo?.logs,
      });
      const errorMessage = errorInfo.message || errorInfo.originalError?.message || e.message || 'Unknown error';
      return res.status(400).json(err(new ContractInteractionError(errorMessage)));
    }
  },
};

module.exports = draftController;

