const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const { SYSVAR_CLOCK_PUBKEY, Transaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { handleSolanaError } = require('../../utils/solanaErrorHandler');
const { ensureAdminBalance, sendErrorResponse } = require('../../utils/controllerHelpers');
const solanaTxService = require('../../services/solanaTxService');
const { getTransactionMetadata, getAnswerEndTimeFromAccount } = require('../../utils/solanaTransactionParser');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const ContractInteractionError = require('../../exceptions/ContractInteractionError');
const BaseQuestDaoController = require('./baseController');

const decisionController = {
  setDaoSuccess: async (req, res) => {
    const { quest_key } = req.params;
    let quest;
    let receipt;
    const updateInfo = {};
    let expectedResult = 'success';

    quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);
    if (!quest) throw new QuestNotFound();

    try {
      const { answerKeys } = await BaseQuestDaoController.getSortedAnswerKeysByVotePower(quest_key, quest);

      // Get expected result from on-chain vote counts
      try {
        const governanceSDK = getGovernanceSDK();
        const questKeyBN = convertToBN(quest_key);
        const [decisionVotePDA] = governanceSDK.getDecisionVotePDA(questKeyBN);
        const decisionVote = await governanceSDK.program.account.decisionVote.fetch(decisionVotePDA);
        const countSuccess = decisionVote.countSuccess?.toNumber?.() || decisionVote.count_success || 0;
        const countAdjourn = decisionVote.countAdjourn?.toNumber?.() || decisionVote.count_adjourn || 0;
        expectedResult = countAdjourn > countSuccess ? 'adjourn' : 'success';
      } catch (_) { }

      receipt = await solanaTxService.setDecision(quest_key, answerKeys);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const msg = errorInfo.message || e?.message || '';
      if (msg === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          await client.QuestDao.UpdateData(quest_key, { dao_answer_tx: e.transactionHash || errorInfo.originalError?.transactionHash });
        } catch (dbError) {
          console.warn('Failed to update DB after transaction timeout (setDaoSuccess):', quest_key);
        }
        return res.status(202).json(success('', 'Pending'));
      }

      try {
        try { await solanaTxService.startDecision(quest_key); } catch (_) { }
        const { answerKeys: answerKeys2 } = await BaseQuestDaoController.getSortedAnswerKeysByVotePower(quest_key, quest);
        receipt = await solanaTxService.setDecision(quest_key, answerKeys2);

        // Answer keys are already set by setDecision, no need to call setAnswer here
        // if (answerKeys2.length > 0) {
        //   try {
        //     await solanaTxService.setAnswer(quest_key, answerKeys2);
        //   } catch (_) {}
        // }
      } catch (fallbackErr) {
        await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
        const fallbackErrorInfo = handleSolanaError(fallbackErr);
        const detail = fallbackErrorInfo.message || fallbackErr?.message || msg || 'SetDecisionFallbackFailed';
        return res.status(400).json(err(new ContractInteractionError(detail)));
      }
    }

    try {
      let result = expectedResult;
      try {
        const governanceSDK = getGovernanceSDK();
        const questKeyBN = convertToBN(quest_key);
        const governanceItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
        if (governanceItem.decisionResult) {
          if (governanceItem.decisionResult.adjourn !== undefined) {
            result = 'adjourn';
          } else if (governanceItem.decisionResult.success !== undefined) {
            result = 'success';
          }
        }
      } catch (_) { }

      if (result === 'adjourn') {
        updateInfo['quest_status'] = 'ADJOURN';
      } else {
        let answerStartAt = new Date();
        let answerEndAt = null;

        if (receipt?.transactionHash) {
          try {
            const governanceSDK = getGovernanceSDK();
            const questKeyBN = convertToBN(quest_key);
            const txMetadata = await getTransactionMetadata(governanceSDK.connection, receipt.transactionHash, {
              governanceSDK,
              questKeyBN,
            });

            if (txMetadata.timestamp) {
              answerStartAt = txMetadata.timestamp;
            }

            if (txMetadata.answerEndTime) {
              answerEndAt = txMetadata.answerEndTime;
            } else {
              answerEndAt = await getAnswerEndTimeFromAccount(governanceSDK, questKeyBN);
            }
          } catch (metaError) {
            console.warn(`Failed to get transaction metadata for ${receipt.transactionHash}:`, metaError.message);
          }
        }

        updateInfo['dao_answer_start_at'] = answerStartAt;
        updateInfo['dao_answer_end_at'] = answerEndAt || answerStartAt;
        updateInfo['quest_status'] = 'DAO_SUCCESS';
      }

      updateInfo['quest_pending'] = false;
      updateInfo['dao_answer_tx'] = receipt.transactionHash || '';

      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', result));
    } catch (e) {
      console.warn(`Database update failed ${quest_key} $SetGovDecision: ${e}`);
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  startDaoSuccess: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;
    const updateInfo = {};

    const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);

    if (quest.quest_pending !== true) {
      try {
        await client.QuestDao.OnPending(quest_key);
      } catch (e) {
        if (quest.quest_status !== 'FINISH' && quest.quest_status !== 'APPROVE' && quest.quest_status !== 'PUBLISH') {
          return res.status(400).json(err(e));
        }
      }
    }

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      try {
        const item = await governanceSDK.fetchGovernanceItem(questKeyBN);
        if (item) {
          const result = item.questResult || item.quest_result; // enum or number
          const approved = typeof result === 'number' ? (result === 1) : (typeof result?.approved !== 'undefined');
          const questEnd = (item.questEndTime?.toNumber?.() || item.quest_end_time?.toNumber?.() || 0);
          const nowSlot = await governanceSDK.connection.getSlot('confirmed');
          const nowOnChain = await governanceSDK.connection.getBlockTime(nowSlot);
          if (!approved || (nowOnChain !== null && questEnd > nowOnChain)) {
            await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
            const why = !approved ? 'Draft result is not Approved' : 'Draft period has not ended yet';
            return res.status(400).json(err(new ContractInteractionError(`Cannot start decision: ${why}. Please end draft (PATCH /draft-end) and make draft result (PATCH /draft/make) first.`)));
          }
        }
      } catch (preErr) {
      }
      const deadline = Date.now() + 15000;
      let ok = false;
      while (Date.now() < deadline) {
        try {
          const item = await governanceSDK.fetchGovernanceItem(questKeyBN);
          if (item && (item.questKey || item.quest_key)) {
            ok = true;
            break;
          }
        } catch (_) { }
        await new Promise(r => setTimeout(r, 800));
      }
      if (!ok) {
        await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
        return res.status(400).json(err(new ContractInteractionError('Governance item not ready')));
      }
    } catch (e) {
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });

      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      return res.status(400).json(err(new ContractInteractionError(`Governance item check failed: ${errorMessage}`)));
    }

    try {
      await ensureAdminBalance(2e6);
      receipt = await solanaTxService.startDecision(quest_key);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const msg = errorInfo.message || e?.message || '';
      if (!msg) {
        return res.status(400).json(err(new ContractInteractionError('StartDecisionFailed')));
      }

      const logsText = Array.isArray(errorInfo.logs) ? errorInfo.logs.join('\n') : '';
      const alreadyInUse = msg.toLowerCase().includes('already in use') || logsText.toLowerCase().includes('already in use');
      if (alreadyInUse) {
        receipt = { transactionHash: e.transactionHash || errorInfo.originalError?.transactionHash || 'START_DECISION_ALREADY_EXISTS' };
      } else if (msg === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        const timeoutHandler = async (error, errorInfo, questKey) => {
          await client.QuestDao.UpdateData(questKey, {
            dao_success_tx: error.transactionHash || errorInfo.originalError?.transactionHash
          });
        };
        return handleControllerError(e, res, { questKey: quest_key, onTimeout: timeoutHandler });
      }

      if (!receipt) {
        try {
          await ensureAdminBalance(2e6);
          const governanceSDK = getGovernanceSDK();
          const questKeyBN = convertToBN(quest_key);
          const adminKp = solanaTxService.getAdminKeypair();
          const tx = await governanceSDK.startDecision(questKeyBN, adminKp.publicKey);
          const { blockhash } = await governanceSDK.connection.getLatestBlockhash('confirmed');
          tx.feePayer = adminKp.publicKey;
          tx.recentBlockhash = blockhash;
          tx.sign(adminKp);
          await solanaTxService.sendAndConfirm(tx, [adminKp], {
            maxRetries: 3,
            computeBudget: {
              computeUnitPrice: parseInt(process.env.SOLANA_PRIORITY_FEE) || 1000,
              computeUnitLimit: parseInt(process.env.SOLANA_COMPUTE_LIMIT) || 200000,
            },
          });
          receipt = { transactionHash: 'START_DECISION_FALLBACK' };
        } catch (fallbackErr) {
          // No waiting - EndSuccessTime should be called first to set end_time to past
          try {
            const governanceSDK = getGovernanceSDK();
            const questKeyBN = convertToBN(quest_key);
            const decisionVote = await governanceSDK.fetchDecisionVote(questKeyBN);
            if (decisionVote) {
              receipt = { transactionHash: 'START_DECISION_VERIFIED' };
            }
          } catch (_) { }
          if (!receipt) {
            const fbInfo = handleSolanaError(fallbackErr);
            const fbMsg = fbInfo.message || fallbackErr?.message || '';
            try {
              const governanceSDK = getGovernanceSDK();
              const questKeyBN = convertToBN(quest_key);
              const exists = await governanceSDK.fetchDecisionVote(questKeyBN);
              if (exists) {
                receipt = { transactionHash: 'START_DECISION_VERIFIED_2' };
              }
            } catch (_) { }
            if (!receipt) {
              return res.status(400).json(err(new ContractInteractionError(fbMsg || 'StartDecisionFallbackFailed')));
            }
          }
        }
      }
    }

    try {
      let startAt = new Date();
      let endAt = null;

      if (receipt?.transactionHash) {
        try {
          const governanceSDK = getGovernanceSDK();
          const txMetadata = await getTransactionMetadata(governanceSDK.connection, receipt.transactionHash, {
            governanceSDK,
            questKeyBN: convertToBN(quest_key),
          });

          if (txMetadata.timestamp) {
            startAt = txMetadata.timestamp;
          }

          if (txMetadata.decisionEndTime) {
            endAt = txMetadata.decisionEndTime;
          } else {
            const questKeyBN = convertToBN(quest_key);
            endAt = await getDecisionEndTimeFromAccount(governanceSDK, questKeyBN);
          }
        } catch (_) { }
      }

      updateInfo['dao_success_start_at'] = startAt;
      updateInfo['dao_success_end_at'] = endAt || startAt;
      updateInfo['dao_success_tx'] = receipt.transactionHash;
      updateInfo['quest_pending'] = false;
      await client.QuestDao.UpdateDecisionTime(quest_key, updateInfo);
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      return res.status(200).json(success('', 'Start Decision'));
    } catch (e) {
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  makeDaoSuccess: async (req, res) => {
    const { quest_key } = req.params;
    let quest;
    let receipt;
    let updateInfo = {};

    try {
      quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);
      if (!quest) throw new QuestNotFound();
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      return sendErrorResponse(e, res);
    }

    // No waiting needed - EndSuccessTime should be called first to set end_time to past

    try {
      const answerKeys = Array.isArray(quest.answers)
        ? quest.answers.map(a => Number(a?.answer_key)).filter(n => Number.isFinite(n))
        : [];
      receipt = await solanaTxService.makeDecision(quest_key, answerKeys);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      try {
        console.error('[makeDaoSuccess] On-chain error:', {
          name: errorInfo?.name,
          code: errorInfo?.code || errorInfo?.number,
          message: errorInfo?.message || e?.message,
          logs: errorInfo?.logs,
        });
      } catch (_) { }

      if (e.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          await client.QuestDao.UpdateData(quest_key, { dao_answer_tx: e.transactionHash || errorInfo.originalError?.transactionHash });
        } catch (dbError) {
          console.warn('Failed to update DB after transaction timeout (makeDaoSuccess):', quest_key);
        }
        return res.status(202).json(success('', 'Pending'));
      }
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });

      const msg = (process.env.NODE_ENV === 'dev' && errorInfo?.logs)
        ? `${errorInfo.message || e.message}\nLOGS:${JSON.stringify(errorInfo.logs, null, 2)}`
        : (errorInfo.message || errorInfo.originalError?.message || e.message);
      if ((msg || '').toLowerCase().includes('votingperiodnotended')) {
        // No waiting - EndSuccessTime should be called first
        try {
          const answerKeys = Array.isArray(quest.answers)
            ? quest.answers.map(a => Number(a?.answer_key)).filter(n => Number.isFinite(n))
            : [];
          receipt = await solanaTxService.makeDecision(quest_key, answerKeys);
        } catch (retryErr) {
          const ri = handleSolanaError(retryErr);
          const rm = ri.message || retryErr?.message || msg;
          return res.status(400).json(err(new ContractInteractionError(rm)));
        }
      } else {
        return res.status(400).json(err(new ContractInteractionError(msg)));
      }
    }

    try {
      let answerStartAt = new Date();
      let answerEndAt = null;
      let decisionResult = 'success';

      if (receipt?.transactionHash) {
        try {
          const governanceSDK = getGovernanceSDK();
          const questKeyBN = convertToBN(quest_key);
          const txMetadata = await getTransactionMetadata(governanceSDK.connection, receipt.transactionHash, {
            governanceSDK,
            questKeyBN,
          });

          if (txMetadata.timestamp) {
            answerStartAt = txMetadata.timestamp;
          }

          if (txMetadata.decisionResult) {
            decisionResult = txMetadata.decisionResult;
          }

          if (txMetadata.answerEndTime) {
            answerEndAt = txMetadata.answerEndTime;
          } else {
            answerEndAt = await getAnswerEndTimeFromAccount(governanceSDK, questKeyBN);
          }
        } catch (metaError) {
          console.warn(`Failed to get transaction metadata for ${receipt.transactionHash}:`, metaError.message);
        }
      }

      updateInfo['dao_answer_start_at'] = answerStartAt;
      updateInfo['dao_answer_end_at'] = answerEndAt || answerStartAt;
      updateInfo['quest_status'] = 'DAO_SUCCESS';
      updateInfo['quest_pending'] = false;
      updateInfo['dao_answer_tx'] = receipt.transactionHash || '';

      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', 'success'));
    } catch (e) {
      console.warn(`Database update failed ${quest_key} $MakeDecision : ${e}`);
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  EndSuccessTime: async (req, res) => {
    const { quest_key } = req.params;

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const governanceItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
      if (!governanceItem) {
        return res.status(400).json(err(new ContractInteractionError('Governance item not found')));
      }

      // Set end_time to past (start_time + 1) to end immediately
      const startTime = governanceItem?.decisionStartTime?.toNumber?.() || 1;
      const endTimeBN = new BN(startTime + 1);

      await ensureAdminBalance(2e6);
      const adminKp = solanaTxService.getAdminKeypair();
      const [configPDA] = governanceSDK.getConfigPDA();
      const [governanceItemPDA] = governanceSDK.getGovernanceItemPDA(questKeyBN);

      const ix = await governanceSDK.program.methods
        .setDecisionEndTime(questKeyBN, endTimeBN)
        .accountsPartial({
          config: configPDA,
          governanceItem: governanceItemPDA,
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

      await client.QuestDao.UpdateData(quest_key, { dao_success_end_at: new Date(), quest_pending: false });
      return res.status(200).json(success('', 'Success End time updated'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      console.error('[EndSuccessTime] Error:', {
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

module.exports = decisionController;

