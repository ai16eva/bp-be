const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const { SYSVAR_CLOCK_PUBKEY, Transaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { ensureAdminBalance, handleControllerError, sendErrorResponse } = require('../../utils/controllerHelpers');
const solanaTxService = require('../../services/solanaTxService');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const InvalidQuestStatus = require('../../exceptions/quest/InvalidQuestStatus');
const ContractInteractionError = require('../../exceptions/ContractInteractionError');
const BaseQuestDaoController = require('./baseController');

const answerController = {
  setAnswer: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;

    try {
      const quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);

      if (quest.quest_status !== 'DAO_SUCCESS') {
        return res.status(400).json(err(new InvalidQuestStatus('Quest must be in DAO_SUCCESS status')));
      }

      const { answerKeys, highestVoteAnswerKey } = await BaseQuestDaoController.getSortedAnswerKeysByVotePower(quest_key, quest);

      if (!answerKeys.length) {
        return res.status(400).json(err(new ContractInteractionError('NoAnswersProvided')));
      }

      const answerAlreadySet = await BaseQuestDaoController.checkAnswerAlreadySet(quest_key);

      if (answerAlreadySet) {
        try {
          const answerKey = await BaseQuestDaoController.getSelectedAnswerKeyFromChain(quest_key);
          if (answerKey) {
            await BaseQuestDaoController.updateSelectedAnswerInDB(quest_key, answerKey);
          }
        } catch (e) {
        }
        return res.status(200).json(success('', 'Answer already set on-chain'));
      }

      try {
        await ensureAdminBalance(2e6);
        receipt = await solanaTxService.setAnswer(quest_key, answerKeys);
      } catch (e) {
        const timeoutHandler = async (error, errorInfo, questKey) => {
          await client.QuestDao.UpdateData(questKey, {
            dao_answer_tx: error.transactionHash || errorInfo.originalError?.transactionHash
          });
        };
        return handleControllerError(e, res, {
          questKey: quest_key,
          onTimeout: timeoutHandler,
        });
      }

      let selectedAnswerKey = await BaseQuestDaoController.getSelectedAnswerKeyFromChain(quest_key);
      const answerToUpdate = selectedAnswerKey || (highestVoteAnswerKey ? String(highestVoteAnswerKey) : null);

      try {
        if (receipt && receipt.transactionHash) {
          await client.QuestDao.UpdateData(quest_key, {
            dao_answer_tx: receipt.transactionHash
          });
        }

        if (answerToUpdate) {
          await BaseQuestDaoController.updateSelectedAnswerInDB(quest_key, answerToUpdate);
        }
      } catch (e) {
        // Continue even if DB update fails
      }

      return res.status(200).json(success('', 'Answer set successfully'));
    } catch (e) {
      return sendErrorResponse(e, res);
    }
  },

  finalizeAnswer: async (req, res) => {
    const { quest_key } = req.params;

    try {
      const quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);

      if (quest.quest_status !== 'DAO_SUCCESS') {
        return res.status(400).json(err(new InvalidQuestStatus('Quest must be in DAO_SUCCESS status')));
      }

      await ensureAdminBalance(2e6);

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const adminKp = solanaTxService.getAdminKeypair();

      const [configPDA] = governanceSDK.getConfigPDA();
      const [governanceItemPDA] = governanceSDK.getGovernanceItemPDA(questKeyBN);
      const [answerVotePDA] = governanceSDK.getAnswerVotePDA(questKeyBN);

      const ix = await governanceSDK.program.methods
        .finalizeAnswer(questKeyBN)
        .accountsPartial({
          authority: adminKp.publicKey,
          config: configPDA,
          governanceItem: governanceItemPDA,
          answerVote: answerVotePDA,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .instruction();

      const { blockhash } = await governanceSDK.connection.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.add(ix);
      tx.recentBlockhash = blockhash;
      tx.feePayer = adminKp.publicKey;
      tx.sign(adminKp);

      await solanaTxService.sendAndConfirm(tx, [adminKp]);

      return res.status(200).json(success('', 'Answer vote finalized successfully'));
    } catch (e) {
      return sendErrorResponse(e, res);
    }
  },

  EndAnswerTime: async (req, res) => {
    const { quest_key } = req.params;
    const { durationSeconds } = req.body;

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      let endTimeBN;
      const duration = durationSeconds ? Number(durationSeconds) : 2;

      try {
        const governanceItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
        const answerStartTime = governanceItem.answerStartTime;
        if (answerStartTime && !answerStartTime.isZero()) {
          endTimeBN = new BN(answerStartTime.toNumber() + duration);
        } else {
          const slotNow = await governanceSDK.connection.getSlot('confirmed');
          const nowOnChain = (await governanceSDK.connection.getBlockTime(slotNow)) ?? Math.floor(Date.now() / 1000);
          endTimeBN = new BN(nowOnChain + duration);
        }
      } catch (fetchErr) {
        const slotNow = await governanceSDK.connection.getSlot('confirmed');
        const nowOnChain = (await governanceSDK.connection.getBlockTime(slotNow)) ?? Math.floor(Date.now() / 1000);
        endTimeBN = new BN(nowOnChain + duration);
      }

      await ensureAdminBalance(2e6);

      const adminKp = solanaTxService.getAdminKeypair();
      const [configPDA] = governanceSDK.getConfigPDA();
      const [governanceItemPDA] = governanceSDK.getGovernanceItemPDA(questKeyBN);
      const [answerVotePDA] = governanceSDK.getAnswerVotePDA(questKeyBN);

      const ix = await governanceSDK.program.methods
        .setAnswerEndTime(questKeyBN, endTimeBN)
        .accountsPartial({
          config: configPDA,
          governanceItem: governanceItemPDA,
          answerVote: answerVotePDA,
          authority: adminKp.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .instruction();

      const { blockhash } = await governanceSDK.connection.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.add(ix);
      tx.recentBlockhash = blockhash;
      tx.feePayer = adminKp.publicKey;
      tx.sign(adminKp);
      await solanaTxService.sendAndConfirm(tx, [adminKp]);

      await client.QuestDao.UpdateData(quest_key, { dao_answer_end_at: new Date() });

      return res.status(200).json(success('', 'Answer End time updated'));
    } catch (e) {
      return sendErrorResponse(e, res);
    }
  },
};

module.exports = answerController;

