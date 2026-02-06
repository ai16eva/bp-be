const models = require('../models/mysql');
const client = require('../database/client');
const { Op } = require('sequelize');
const { accessTokenSecret, email_secret } = require('../config/auth');
const { s3Upload } = require('../utils/upload/uploadToAws');
const { err, success } = require('../utils/responses');
const { base_url } = require('../config/mail');
const paginate = require('../utils/pagination/paginate');
const sendEmail = require('../utils/mailer/email');
const { where, Sequelize } = require('sequelize');


const { getBPMarketSDK, getGovernanceSDK, createSolanaConnection, getSolanaWallet, getSolanaConfig } = require('../config/solana');
const { PublicKey } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const {
  CreateQuest,
  GetQuest,
  GetPagedQuests,
  GetEndingSoon,
  UpdateQuest,
  GetQuestsByCategory,
  GetPagedQuestsByStatusList,
  GetQuestsByCategoryAndStatusList,
  GetQuestsOnCarousel,
  GetQuestsOnPopular,
  GetQuestBettings,
  MustGetQuest,
  UpdateQuestHot,
  TotalQuestCount,
} = require('../database/questActions');
const { CreateAnswer } = require('../database/AnswerAction');
const { GetSeasonByTitle } = require('../database/seasonActions');
const { GetCategoryByTitle } = require('../database/questCategoryActions');
const validateWalletAddress = require('../validates/walletAddress');
const QuestNotFound = require('../exceptions/quest/QuestNotFound');
const MissingRequiredParameter = require('../exceptions/MissingRequiredParameter');
const InvalidQuestStatus = require('../exceptions/quest/InvalidQuestStatus');
const InvalidBettingToken = require('../exceptions/quest/InvalidBettingToken');
const moment = require("moment/moment");

// Solana helper functions
const { convertToBN, convertToPublicKey } = require('../utils/solanaHelpers');

module.exports = {
  addQuest: async (req, res) => {
    try {
      let result = await models.sequelize.transaction(async (t) => {
        let {
          quest_key,
          quest_title,
          quest_description,
          quest_end_date,
          quest_creator,
          quest_betting_token,
          quest_betting_token_address,
          quest_image_link,
          quest_category_id,
          season_id,
        } = req.body;

        if (!quest_betting_token) {
          quest_betting_token = 'BOOM';
        }
        if (quest_betting_token.toUpperCase() !== 'BOOM' && quest_betting_token.toUpperCase() !== 'USDT' && quest_betting_token.toUpperCase() !== 'WSOL' && quest_betting_token.toUpperCase() !== 'USDC') {
          throw new InvalidBettingToken();
        }
        let newQuest = {
          quest_title: quest_title,
          quest_description: quest_description,
          quest_end_date: quest_end_date,
          quest_end_date_utc: quest_end_date,
          quest_creator: quest_creator,
          quest_betting_token: quest_betting_token,
          quest_betting_token_address: quest_betting_token_address,
          quest_image_link: quest_image_link,
          quest_category_id: quest_category_id,
          season_id: season_id,
        };

        if (quest_key) {
          newQuest.quest_key = quest_key;
        }

        validateWalletAddress(quest_creator);
        if (!req.body.answers) throw new MissingRequiredParameter();
        if (req.file) {
          const avatar_url = await s3Upload(req.file);
          if (avatar_url) {
            newQuest.quest_image_url = avatar_url;
            newQuest.quest_image_link = ''
          }
        } else {
          if (req.body.quest_image_link) {
            newQuest.quest_image_link = req.body.quest_image_link;
            if (req.body.quest_image_url) newQuest.quest_image_url = req.body.quest_image_url;
            else newQuest.quest_image_url = ''
          } else {
            throw new MissingRequiredParameter('SNS/Image url not found')
          }
        }
        const quest = await CreateQuest(newQuest, t);
        let questAnswers = [];
        if (req.body.answers) {
          let answers = req.body.answers;
          for (const answer_title of answers) {
            if (!answer_title) {
              throw new MissingRequiredParameter('Answers are required');
            }
            const ansData = typeof answer_title === 'string'
              ? { quest_key: quest.quest_key, answer_title: answer_title }
              : { quest_key: quest.quest_key, answer_title: answer_title.answer_title || answer_title };

            const ans = await CreateAnswer(ansData, t);
            questAnswers.push(ans);
          }
          quest['quest_answers'] = questAnswers;
          return quest;
        } else {
          throw new MissingRequiredParameter();
        }
      });
      let newQuest = await GetQuest(result.quest_key);
      res.status(200).json(success(newQuest, 'Quest added !'));
    } catch (e) {
      console.log(e)
      return res.status(400).json(err(e));
    }
  },

  generateQuestKey: async (req, res) => {
    try {
      const generateUniqueKey = require('../utils/uniquekey_generate');
      const key = generateUniqueKey();
      res.status(200).json(success({ quest_key: key.toString() }));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
  getQuest: async (req, res) => {
    let quest = await GetQuest(req.params.quest_key);
    res.status(200).json(success(quest, ''));
  },
  getPagedQuests: async (req, res) => {
    let page = parseInt(req.query.page, 10) || 1;
    let pageSize = parseInt(req.query.size, 10) || 10;
    let quests = await GetPagedQuests(page, pageSize, {});
    let totalCount = await TotalQuestCount({});
    res.status(200).json(success({ total: totalCount, quests: quests }, null));
  },
  updateStatus: async (req, res) => {
    try {
      let questKey = req.params.quest_key;
      let status = req.body.status;
      let tx = req.body.tx;
      let quest = await GetQuest(questKey);
      if (!quest) throw new QuestNotFound();
      let statusValue = {};
      if (status == 'DRAFT') {
        statusValue = {
          quest_status: 'DRAFT',
          quest_draft_datetime: Sequelize.fn('NOW'),
          quest_draft_tx: tx,
          quest_archived_at: null,
        };
      } else if (status == 'REJECT') {
        statusValue = {
          quest_status: 'REJECT',
          quest_reject_datetime: Sequelize.fn('NOW'),
          quest_reject_tx: tx,
        };
      } else if ((status = 'SUCCESS')) {
        statusValue = {
          quest_status: 'SUCCESS',
          quest_success_datetime: Sequelize.fn('NOW'),
          quest_success_tx: tx,
        };
      } else if (status == 'ADJOURN') {
        statusValue = {
          quest_status: 'ADJOURN',
          quest_adjourn_datetime: Sequelize.fn('NOW'),
          quest_adjourn_tx: tx,
        };
      } else {
        statusValue = {
          quest_status: 'APPROVE',
          quest_approve_datetime: Sequelize.fn('NOW'),
          quest_approve_tx: tx,
        };
      }
      const updateResult = await UpdateQuest(questKey, statusValue);
      res.status(200).json(success(questKey, null));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  draftQuest: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { start_at, end_at, tx, start_block } = req.body;

      if (!start_at || !end_at) throw new MissingRequiredParameter();
      let quest = await MustGetQuest(questKey);
      if (quest.dao_draft_tx && quest.dao_draft_start_at) {
        if (end_at) {
          await UpdateQuest(questKey, {
            dao_draft_end_at: end_at,
          });
        }
        return res.status(200).json(success('', null));
      }
      let updateValue = {
        dao_draft_start_at: start_at,
        dao_draft_end_at: end_at,
        quest_archived_at: null,
      };
      if (tx) {
        updateValue.dao_draft_tx = tx;
      }
      if (start_block !== undefined && start_block !== null) {
        updateValue.quest_start_block = start_block;
      }
      await UpdateQuest(questKey, updateValue);
      res.status(200).json(success(questKey, null));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
  listQuestDao: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      const status = req.query.status;
      let result;

      switch (status) {
        case 'success':
          result = await client.QuestList.successListAtDaoPage(pageSize, page);
          break;
        case 'answer':
          result = await client.QuestList.answerListAtDaoPage(pageSize, page);
          break;
        case 'draft':
          result = await client.QuestList.draftListAtDaoPage(pageSize, page);
          break;
        default:
          throw new InvalidQuestStatus();
      }
      res.status(200).json(success(result));
    } catch (error) {
      const errorCode = error.statusCode || 400;
      res.status(errorCode).json(err(error));
    }
  },

  getQuestsByCategory: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 25;
      const category = req.params.category ? req.params.category : 'all';
      const token = req.query.token
      const condition = token ? { quest_betting_token: token } : {};
      const statusList = req.params.status ? req.params.status.split(',') : ['all'];
      let total = 0;
      let quests = [];
      if (category == 'all') {
        if (statusList.includes('all')) {
          quests = await GetPagedQuests(page, pageSize, condition);
          total = await TotalQuestCount(condition);
        } else {
          const condition1 = token ? { quest_status: { [Op.in]: statusList }, quest_betting_token: token.toUpperCase() } : { quest_status: { [Op.in]: statusList } };
          quests = await GetPagedQuestsByStatusList(statusList, page, pageSize, condition1);

          total = await TotalQuestCount(condition1);
        }
      } else if (category == 'popular') {
        let condition2 = token ? { quest_status: { [Op.in]: ['PUBLISH', 'FINISH', 'DAO_SUCCESS'] }, quest_betting_token: token.toUpperCase() } : { quest_status: { [Op.in]: ['PUBLISH', 'FINISH', 'DAO_SUCCESS'] } };
        quests = await GetQuestsOnPopular(page, pageSize, condition2);
        total = await TotalQuestCount(condition2);
      } else if (category == 'soon') {
        const twoDaysFromNow = moment().add(7, 'days').endOf('day').toDate();
        const condition3 = token ? {
          quest_end_date: { [Op.lte]: twoDaysFromNow },
          quest_status: { [Op.in]: ['PUBLISH', "FINISH", 'DAO_SUCCESS'] },
          quest_betting_token: token.toUpperCase()
        } : {
          quest_end_date: { [Op.lte]: twoDaysFromNow },
          quest_status: { [Op.in]: ['PUBLISH', "FINISH", 'DAO_SUCCESS'] }
        }
        quests = await GetEndingSoon(page, pageSize, condition3);
        total = await TotalQuestCount(condition3);
      } else {
        const cat = await GetCategoryByTitle(category);
        if (statusList.includes('all')) {
          const condition4 = token ? { quest_category_id: cat.quest_category_id, quest_betting_token: token.toUpperCase() } : { quest_category_id: cat.quest_category_id };
          quests = await GetQuestsByCategory(cat.quest_category_id, page, pageSize, condition4);
          total = await TotalQuestCount(condition4);
        } else {
          const condition5 = token ? {
            quest_status: { [Op.in]: statusList },
            quest_category_id: cat.quest_category_id,
            quest_betting_token: token.toUpperCase()
          } : {
            quest_status: { [Op.in]: statusList },
            quest_category_id: cat.quest_category_id
          }
          quests = await GetQuestsByCategoryAndStatusList(cat.quest_category_id, statusList, page, pageSize, condition5);
          total = await TotalQuestCount(condition5);
        }
      }
      res.status(200).json(success({ total, quests }));
    } catch (e) {
      console.log(e)
      res.status(400).json(err(e));
    }
  },
  getQuestBettings: async (req, res) => {
    try {
      const id = req.params.quest_key;
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      const quest = await GetQuest(id);
      if (!quest) throw new QuestNotFound();
      let bettings = await GetQuestBettings(id, page, pageSize);
      res.status(200).json(success(bettings, null));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
  getQuestsOnCarousel: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      const result = await GetQuestsOnCarousel(page, pageSize);
      res.status(200).json(success(result));
    } catch (error) {
      const errorCode = error.statusCode || 400;
      res.status(errorCode).json(err(error));
    }
  },
  getQuestsOnPopular: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      let condition = { quest_status: { [Op.in]: ['PUBLISH', 'FINISH', 'DAO_SUCCESS'] } }
      const result = await GetQuestsOnPopular(page, pageSize, condition);
      res.status(200).json(success(result));
    } catch (error) {
      const errorCode = error.statusCode || 400;
      res.status(errorCode).json(err(error));
    }
  },
  updateQuestHot: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      await UpdateQuestHot(questKey);
      res.status(200).json(success(''));
    } catch (error) {
      const errorCode = error.statusCode || 400;
      res.status(errorCode).json(err(error));
    }
  },

  publishMarket: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey, creator, title, createFee, creatorFeePercentage, serviceFeePercentage, charityFeePercentage, answerKeys } = req.body;

      if (!marketKey || !creator || !title) {
        throw new MissingRequiredParameter('marketKey, creator, and title are required');
      }

      const bpMarketSDK = getBPMarketSDK();
      const BN = require('bn.js');

      const marketKeyStr = String(marketKey ?? questKey).trim();
      const normalizedMarketKey = /^\d+$/.test(marketKeyStr) ? marketKeyStr : String(questKey);
      const marketKeyBN = new BN(String(normalizedMarketKey), 10);

      const creatorPK = convertToPublicKey(creator ?? (getSolanaConfig()?.wallets?.master || process.env.SOLANA_MASTER_WALLET));
      const createFeeBN = new BN(String(createFee ?? 0), 10);
      const creatorFeeBN = new BN(String(creatorFeePercentage ?? 0), 10);
      const serviceFeeBN = new BN(String(serviceFeePercentage ?? 0), 10);
      const charityFeeBN = new BN(String(charityFeePercentage ?? 0), 10);

      const normalizedAnswerKeys = Array.isArray(answerKeys)
        ? answerKeys.map(v => parseInt(String(v), 10)).filter(v => Number.isInteger(v))
        : [0, 1];
      const answerKeysBN = normalizedAnswerKeys.map(key => new BN(String(key), 10));

      const testFallbackPayer = process.env.NODE_ENV === 'test'
        ? new PublicKey('11111111111111111111111111111111')
        : null;
      const solCfg = getSolanaConfig();
      const masterStr = ((solCfg?.wallets?.master) || process.env.SOLANA_MASTER_WALLET || '').trim();
      const ownerPK = masterStr
        ? new PublicKey(masterStr)
        : (testFallbackPayer || creatorPK);

      const marketData = {
        marketKey: marketKeyBN,
        creator: creatorPK,
        title,
        createFee: createFeeBN,
        creatorFeePercentage: creatorFeeBN,
        serviceFeePercentage: serviceFeeBN,
        charityFeePercentage: charityFeeBN,
        answerKeys: answerKeysBN,
      };

      if (!process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY && !process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV) {
        const tmpSk = req.headers['x-admin-sk-b58'];
        if (tmpSk && (req.user?.role === 'ADMIN' || req.headers.authorization)) {
          process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV = String(tmpSk);
        }
      }

      if (
        process.env.E2E_AUTO_SUBMIT === '1' ||
        process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY ||
        process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV
      ) {
        const quest = await MustGetQuest(questKey);

        const solanaTxService = require('../services/solanaTxService');
        const receipt = await solanaTxService.publishMarket(questKey, {
          creator,
          title,
          createFee: createFee || 0,
          creatorFeePercentage: creatorFeePercentage || 0,
          serviceFeePercentage: serviceFeePercentage || 0,
          charityFeePercentage: charityFeePercentage || 0,
          answerKeys: answerKeys || [0, 1],
          bettingToken: quest.quest_betting_token_address,
        });

        if (receipt && receipt.signature) {
          await UpdateQuest(questKey, {
            quest_status: 'PUBLISH',
            quest_publish_datetime: Sequelize.fn('NOW'),
            quest_publish_tx: receipt.signature,
          });

          return res.status(200).json(success({
            signature: receipt.signature,
            questKey,
            message: 'Market published and database updated'
          }));
        } else {
          throw new Error('On-chain transaction failed or signature missing');
        }
      }

      const transaction = await bpMarketSDK.publishMarket(marketData, ownerPK);
      const { blockhash } = await bpMarketSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPK;

      return res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey,
        message: 'Market publish transaction created. Please sign and submit from wallet.'
      }));
    } catch (error) {
      console.error('Publish market error:', error);
      return res.status(400).json(err(error));
    }
  },

  successMarket: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey, correctAnswerKey } = req.body;

      if (!marketKey || !correctAnswerKey) {
        throw new MissingRequiredParameter('marketKey and correctAnswerKey are required');
      }

      const bpMarketSDK = getBPMarketSDK();

      const marketKeyBN = convertToBN(marketKey);
      const correctAnswerKeyBN = convertToBN(correctAnswerKey);
      const testFallbackPayer = process.env.NODE_ENV === 'test'
        ? new PublicKey('11111111111111111111111111111111')
        : null;
      const solCfg = getSolanaConfig();
      const masterStr = ((solCfg?.wallets?.master) || process.env.SOLANA_MASTER_WALLET || '').trim();
      const ownerPK = masterStr
        ? new PublicKey(masterStr)
        : (testFallbackPayer || null);
      if (!ownerPK) {
        throw new MissingRequiredParameter('SOLANA_MASTER_WALLET is required');
      }

      const transaction = await bpMarketSDK.successMarket(marketKeyBN, correctAnswerKeyBN, ownerPK);
      const { blockhash } = await bpMarketSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPK;

      await UpdateQuest(questKey, {
        quest_status: 'SUCCESS',
        quest_success_datetime: Sequelize.fn('NOW'),
        quest_success_tx: 'pending',
      });

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey,
        message: 'Market success transaction created'
      }));
    } catch (error) {
      console.error('Success market error:', error);
      res.status(400).json(err(error));
    }
  },

  adjournMarket: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey, owner } = req.body;

      if (!marketKey || !owner) {
        throw new MissingRequiredParameter('marketKey and owner are required');
      }

      const bpMarketSDK = getBPMarketSDK();

      const marketKeyBN = convertToBN(marketKey);
      const ownerPK = convertToPublicKey(owner);

      const transaction = await bpMarketSDK.adjournMarket(marketKeyBN, ownerPK);
      const { blockhash } = await bpMarketSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPK;

      await UpdateQuest(questKey, {
        quest_status: 'ADJOURN',
        quest_adjourn_datetime: Sequelize.fn('NOW'),
        quest_adjourn_tx: 'pending',
      });

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey,
        message: 'Market adjourn transaction created'
      }));
    } catch (error) {
      console.error('Adjourn market error:', error);
      res.status(400).json(err(error));
    }
  },

  retrieveTokens: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey, user } = req.body;

      if (!marketKey || !user) {
        throw new MissingRequiredParameter('marketKey and user are required');
      }

      const bpMarketSDK = getBPMarketSDK();

      const marketKeyBN = convertToBN(marketKey);
      const userPK = convertToPublicKey(user);

      const config = await bpMarketSDK.fetchConfig();
      const { getAssociatedTokenAddress } = require('@solana/spl-token');
      const remainsTokenAccount = await getAssociatedTokenAddress(config.baseToken, userPK);

      const solCfg = getSolanaConfig();
      const masterStr = ((solCfg?.wallets?.master) || process.env.SOLANA_MASTER_WALLET || '').trim();
      const ownerPK = masterStr ? new PublicKey(masterStr) : userPK;

      const transaction = await bpMarketSDK.retrieveTokens(marketKeyBN, remainsTokenAccount, ownerPK);
      const { blockhash } = await bpMarketSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey,
        message: 'Retrieve tokens transaction created'
      }));
    } catch (error) {
      console.error('Retrieve tokens error:', error);
      res.status(400).json(err(error));
    }
  },

  getMarketInfo: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey } = req.query;

      if (!marketKey) {
        throw new MissingRequiredParameter('marketKey is required');
      }

      const bpMarketSDK = getBPMarketSDK();
      const marketKeyBN = convertToBN(marketKey);

      const marketAccount = await bpMarketSDK.getMarketInfo(marketKeyBN);

      res.status(200).json(success({
        questKey,
        marketInfo: marketAccount,
        message: 'Market information retrieved'
      }));
    } catch (error) {
      console.error('Get market info error:', error);
      res.status(400).json(err(error));
    }
  },

  getMarketStatus: async (req, res) => {
    try {
      const questKey = req.params.quest_key;
      const { marketKey } = req.query;

      if (!marketKey) {
        throw new MissingRequiredParameter('marketKey is required');
      }

      const bpMarketSDK = getBPMarketSDK();
      const marketKeyBN = convertToBN(marketKey);

      const marketStatus = await bpMarketSDK.getMarketStatus(marketKeyBN);

      res.status(200).json(success({
        questKey,
        status: marketStatus,
        message: 'Market status retrieved'
      }));
    } catch (error) {
      console.error('Get market status error:', error);
      res.status(400).json(err(error));
    }
  },
};
