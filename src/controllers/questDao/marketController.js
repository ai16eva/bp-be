const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const models = require('../../models/mysql');
const { getGovernanceSDK, getBPMarketSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const { handleSolanaError } = require('../../utils/solanaErrorHandler');
const { ensureAdminBalance, handleControllerError, sendErrorResponse } = require('../../utils/controllerHelpers');
const solanaTxService = require('../../services/solanaTxService');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const QuestPending = require('../../exceptions/quest/QuestPending');
const InvalidQuestStatus = require('../../exceptions/quest/InvalidQuestStatus');
const AnswerInvalid = require('../../exceptions/AnswerInvalid');
const ContractInteractionError = require('../../exceptions/ContractInteractionError');
const BaseQuestDaoController = require('./baseController');

const marketController = {
  finishQuest: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;
    const updateInfo = {};
    
    const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);
    
    if (quest.quest_pending !== true) {
      try {
        await client.QuestDao.OnPending(quest_key);
      } catch (e) {
        if (quest.quest_status !== 'PUBLISH' && quest.quest_status !== 'APPROVE') {
          return res.status(400).json(err(e));
        }
      }
    }
    
    try {
      receipt = await solanaTxService.finishMarket(quest_key);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      
      if (e.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          await client.QuestDao.UpdateData(quest_key, { quest_finish_tx: e.transactionHash || errorInfo.originalError?.transactionHash });
        } catch (dbError) {
          console.warn('Failed to update DB after transaction timeout (FinishQuest):', quest_key);
        }
        return res.status(202).json(success('', 'Pending'));
      }
      
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      
      const errorMessage = errorInfo.message || errorInfo.originalError?.message || e.message;
      return res.status(400).json(err(new ContractInteractionError(errorMessage)));
    }

    try {
      updateInfo['quest_status'] = 'FINISH';
      updateInfo['quest_finish_tx'] = receipt.transactionHash;
      updateInfo['quest_finish_datetime'] = new Date();
      updateInfo['quest_pending'] = false;
      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', 'Finish'));
    } catch (e) {
      console.warn(`Database update failed ${quest_key} $FinishMarket : ${e}`);
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  publishQuest: async (req, res) => {
    const { quest_key } = req.params;
    let quest;
    let receipt;

    try {
      quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);
      if (quest.quest_status !== 'APPROVE') {
        throw new InvalidQuestStatus('Quest must be in APPROVE status to publish market');
      }
      
      if (quest.quest_pending === true) {
        try {
          await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
          quest = await BaseQuestDaoController.getQuestWithAnswers(quest_key);
          if (quest.quest_pending === true) {
            throw new QuestPending();
          }
        } catch (resetErr) {
          if (resetErr instanceof QuestPending || resetErr instanceof QuestNotFound) {
            throw resetErr;
          }
          throw new QuestPending();
        }
      }
      
      const answers = Array.isArray(quest.answers) ? quest.answers : [];
      if (answers.length === 0) {
        throw new ContractInteractionError('NoAnswersProvided');
      }
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      return res.status(400).json(err(errorMessage));
    }

    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const item = await governanceSDK.fetchGovernanceItem(questKeyBN);
      if (!item || (!item.questKey && !item.quest_key)) {
        throw new ContractInteractionError('Governance item does not exist. Please create governance item first.');
      }
    } catch (e) {
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      if (errorMessage.includes('Account does not exist') || errorMessage.includes('not exist')) {
        return res.status(400).json(err(new ContractInteractionError('Governance item does not exist. Please create governance item first.')));
      }
      return res.status(400).json(err(new ContractInteractionError(`Failed to verify governance_item: ${errorMessage}`)));
    }

    let answerKeys = Array.isArray(quest.answers)
      ? quest.answers
          .map((a) => Number(a?.answer_key))
          .filter((n) => Number.isFinite(n))
      : [];
    if (!answerKeys.length) {
      try {
        const rows = await models.answers.findAll({ where: { quest_key } });
        answerKeys = rows
          .map((r) => Number(r.answer_key))
          .filter((n) => Number.isFinite(n));
      } catch (_) {}
    }
    if (!answerKeys.length) {
      try { await client.QuestDao.UpdateData(quest_key, { quest_pending: false }); } catch (_) {}
      return res.status(400).json(err(new ContractInteractionError('NoAnswersProvided')));
    }

    const creatorFeeBasisPoints = (quest.season?.creator_fee ?? 0) * 100;
    const serviceFeeBasisPoints = (quest.season?.service_fee ?? 0) * 100;
    const charityFeeBasisPoints = (quest.season?.charity_fee ?? 0) * 100;

    const marketData = {
      creator: quest.quest_creator || process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET,
      title: quest.quest_title,
      createFee: 0,
      creatorFeePercentage: creatorFeeBasisPoints,
      serviceFeePercentage: serviceFeeBasisPoints,
      charityFeePercentage: charityFeeBasisPoints,
      answerKeys,
    };

    // Use quest's betting token address if available, otherwise allow override from request body
    if (quest.quest_betting_token_address) {
      marketData.bettingToken = quest.quest_betting_token_address;
    } else if (req.body.bettingToken) {
      marketData.bettingToken = req.body.bettingToken;
    }

    try {
      receipt = await solanaTxService.publishMarket(quest_key, marketData);
    } catch (e) {
      await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      
      const errorInfo = handleSolanaError(e);
      const msg = process.env.NODE_ENV === 'dev' && errorInfo.logs
        ? `${errorInfo.message}\nLOGS:${JSON.stringify(errorInfo.logs, null, 2)}`
        : errorInfo.message || e.message;
      return res.status(400).json(err(new ContractInteractionError(msg)));
    }

    try {
      const quest_publish_tx = receipt.transactionHash;
      const updateData = {
        quest_status: 'PUBLISH',
        quest_publish_tx,
        quest_publish_datetime: new Date(),
        quest_pending: false,
      };
      
      await client.QuestDao.UpdateStatus(quest_key, updateData);
      
      const updatedQuest = await models.quests.findOne({ 
        where: { quest_key },
        attributes: ['quest_key', 'quest_status', 'quest_publish_tx', 'quest_pending']
      });
      
      if (!updatedQuest) {
        throw new Error('Quest not found after update');
      }
      
      if (updatedQuest.quest_status !== 'PUBLISH') {
        await client.QuestDao.UpdateStatus(quest_key, {
          quest_status: 'PUBLISH',
          quest_publish_tx,
          quest_publish_datetime: new Date(),
          quest_pending: false,
        });
        
        const retryQuest = await models.quests.findOne({ 
          where: { quest_key },
          attributes: ['quest_key', 'quest_status']
        });
        
        if (retryQuest && retryQuest.quest_status !== 'PUBLISH') {
          throw new Error(`Failed to update quest status to PUBLISH. Current status: ${retryQuest.quest_status}`);
        }
      }
      
      try {
        const bpMarketSDK = getBPMarketSDK();
        const marketKeyBN = convertToBN(quest_key);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let marketExists = false;
        for (let retry = 0; retry < 5; retry++) {
          try {
            const market = await bpMarketSDK.fetchMarket(marketKeyBN);
            if (market) {
              marketExists = true;
              break;
            }
          } catch (fetchError) {
            if (fetchError.message && (fetchError.message.includes('Account does not exist') || fetchError.message.includes('not found'))) {
              if (retry < 4) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
            } else {
              throw fetchError;
            }
          }
        }
      } catch (_) {}
      
      return res.status(200).json(success('', 'Publish'));
    } catch (e) {
      try {
        await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
      } catch (_) {}
      return res.status(500).json(err('Transaction success but DB Update Failed'));
    }
  },

  adjournQuest: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;
    const updateInfo = {};
    
    try {
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      return sendErrorResponse(e, res);
    }
    
    const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);
    
    try {
      await ensureAdminBalance(2e6);
      receipt = await solanaTxService.adjournMarket(quest_key);
    } catch (e) {
      const timeoutHandler = async (error, errorInfo, questKey) => {
        await client.QuestDao.UpdateData(questKey, { 
          quest_adjourn_tx: error.transactionHash || errorInfo.originalError?.transactionHash 
        });
      };
      return handleControllerError(e, res, { 
        questKey: quest_key, 
        onTimeout: timeoutHandler,
      });
    }

    try {
      updateInfo['quest_status'] = 'ADJOURN';
      updateInfo['quest_adjourn_tx'] = receipt.transactionHash;
      updateInfo['quest_adjourn_datetime'] = new Date();
      updateInfo['quest_pending'] = false;
      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', 'adjourn'));
    } catch (e) {
      console.warn(`Database update failed ${quest_key} to update quest status as Adjourn : ${e}`);
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  successQuest: async (req, res) => {
    const { quest_key } = req.params;
    let answer_key;
    let receipt;
    let updateInfo = {};
    
    try {
      answer_key = await solanaTxService.getSelectedAnswerKey(quest_key);
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message || '';
      if (!errorMessage) {
        return res.status(400).json(err(new ContractInteractionError('GetSelectedAnswerFailed')));
      }
      return res.status(400).json(err(new ContractInteractionError(errorMessage)));
    }

    try {
      const answerKeyStr = typeof answer_key === 'object' && answer_key?.toString ? answer_key.toString() : String(answer_key);
      
      let isZero = answer_key.isZero ? answer_key.isZero() : (answerKeyStr === '0' || answerKeyStr === '');
      if (isZero) {
        try {
          const governanceSDK = getGovernanceSDK();
          const questKeyBN = convertToBN(quest_key);
          const gi = await governanceSDK.fetchGovernanceItem(questKeyBN);
          const ar = gi?.answerResult;
          const arStr = ar?.toString?.() || '0';
          const arZero = ar?.isZero ? ar.isZero() : (arStr === '0');
          if (!arZero) {
            answer_key = ar;
            isZero = false;
          }
        } catch (_) {}
      }
      if (isZero) {
        return res.status(400).json(err(new AnswerInvalid('Answer is not selected yet')));
      }

      try {
        await models.answers.update(
          { answer_selected: true },
          { where: { answer_key: answerKeyStr } }
        );
      } catch (_) {}
      
      await client.Answer.isSelected(answerKeyStr);
      await client.QuestDao.OnPending(quest_key);
    } catch (e) {
      return sendErrorResponse(e, res);
    }

    const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);

    try {
      await ensureAdminBalance(2e6);
      try {
        await solanaTxService.finalizeAnswer(quest_key);
      } catch (e) {
        const finalizeError = handleSolanaError(e);
        const finalizeMessage = finalizeError.message || e.message || '';
        const normalizedMessage = (finalizeMessage || '').toLowerCase();
        const isAlreadyFinalized =
          normalizedMessage.includes('already') &&
          normalizedMessage.includes('final');
        if (finalizeMessage && !isAlreadyFinalized) {
          await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
          return res
            .status(400)
            .json(err(new ContractInteractionError(finalizeMessage)));
        }
      }

      await ensureAdminBalance(2e6);
      const answerKeyStr = typeof answer_key === 'object' && answer_key?.toString ? answer_key.toString() : String(answer_key);
      receipt = await solanaTxService.successMarket(quest_key, answerKeyStr);
    } catch (e) {
      const timeoutHandler = async (error, errorInfo, questKey) => {
        await client.QuestDao.UpdateData(questKey, { 
          quest_success_tx: error.transactionHash || errorInfo.originalError?.transactionHash 
        });
      };
      return handleControllerError(e, res, { 
        questKey: quest_key, 
        onTimeout: timeoutHandler,
      });
    }

    try {
      if (!receipt || !receipt.transactionHash) {
        throw new Error('No transaction hash in receipt from successMarket');
      }
      const updateInfo = {
        quest_status: 'MARKET_SUCCESS',
        quest_success_tx: receipt.transactionHash,
        quest_pending: false,
        quest_success_datetime: new Date(),
      };
      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', 'Quest Success'));
    } catch (e) {
      return res.status(200).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  retrieveToken: async (req, res) => {
    const { quest_key } = req.params;
    let receipt;
    const quest = await BaseQuestDaoController.getQuestWithValidation(quest_key);
    
    try {
      await ensureAdminBalance(2e6);
      receipt = await solanaTxService.retrieveTokens(quest_key);

      const updateInfo = {
        quest_retrieve_tx: receipt.transactionHash,
        quest_retrieved_token: 0,
        quest_pending: false,
      };
      await client.QuestDao.UpdateStatus(quest_key, updateInfo);
      return res.status(200).json(success('', 'Retrieved token'));
    } catch (e) {
      const timeoutHandler = async (error, errorInfo, questKey) => {
        await client.QuestDao.UpdateData(questKey, { 
          quest_retrieve_tx: error.transactionHash || errorInfo.originalError?.transactionHash, 
          quest_pending: 1 
        });
      };
      return handleControllerError(e, res, { 
        questKey: quest_key, 
        onTimeout: timeoutHandler,
      });
    }
  },

  setCancel: async (req, res) => {
    const { quest_key } = req.params;
    try {
      await client.QuestDao.UpdateData(quest_key, { quest_status: 'REJECT' });
      return res.status(200).json(success('', 'reject'));
    } catch (e) {
      return sendErrorResponse(e, res);
    }
  },
};

module.exports = marketController;

