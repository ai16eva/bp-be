const { err, success } = require('../utils/responses');
const {
  CreateBetting,
  GetBetting,
  UpdateBetting,
} = require('../database/bettingActions');
const validateWalletAddress = require('../validates/walletAddress');
const MissingRequiredParameter = require('../exceptions/MissingRequiredParameter');
const { getSolanaService } = require('../services/solanaService');
const marketService = require('../services/marketService');

module.exports = {
  addBetting: async (req, res) => {
    try {
      let { quest_key, answer_key, betting_amount, betting_address } = req.body;

      if (!quest_key || !answer_key || !betting_amount || !betting_address) {
        throw new MissingRequiredParameter(
          'Missing required parameters: quest_key, answer_key, betting_amount, betting_address'
        );
      }

      validateWalletAddress(betting_address);

      try {
        const availability = await marketService.isBetAvailable(
          quest_key,
          answer_key,
          betting_address,
          betting_amount
        );

        if (!availability.available) {
          const reasonMessage = Array.isArray(availability.reasons)
            ? availability.reasons.join(', ')
            : (availability.reason || 'Bet is not available');
          return res.status(400).json(
            err({
              name: 'BetNotAvailable',
              message: reasonMessage,
            })
          );
        }
      } catch (error) {
        console.error('Error checking bet availability:', error);
      }

      const solanaService = getSolanaService();

      const lockStatus = await solanaService.isUserLocked(betting_address);
      if (lockStatus.success && lockStatus.isLocked) {
        return res.status(403).json(
          err({
            name: 'UserLocked',
            message: 'User is locked and cannot place bets',
          })
        );
      }

      let newBetting = {
        quest_key,
        answer_key,
        betting_amount,
        betting_address,
        betting_status: 0,
        created_at: new Date(),
      };

      const betting = await CreateBetting(newBetting);

      res.status(200).json(
        success(
          {
            betting_key: betting.betting_key,
            quest_key: betting.quest_key,
            answer_key: betting.answer_key,
            betting_amount: betting.betting_amount,
            betting_address: betting.betting_address,
            betting_status: betting.betting_status,
            created_at: betting.created_at,
          },
          'Betting record created successfully. Please complete the transaction on blockchain.'
        )
      );
    } catch (e) {
      console.error('Error in addBetting:', e);
      res.status(400).json(err(e));
    }
  },
  confirmBetting: async (req, res) => {
    try {
      const bettingKey = req.params.betting_key;
      const bettingTx = req.body.betting_tx;

      if (!bettingTx) {
        throw new MissingRequiredParameter(
          'betting_tx (signature) is required'
        );
      }

      let betting = await GetBetting(bettingKey);
      if (!betting) {
        return res.status(404).json(
          err({
            name: 'BettingNotFound',
            message: 'Betting record not found',
          })
        );
      }

      if (betting.betting_status === 1) {
        return res
          .status(200)
          .json(success(betting, 'Betting already confirmed'));
      }

      const solanaService = getSolanaService();

      const MAX_RETRIES = 5;
      const RETRY_DELAY_MS = 2000;
      let betInfo = null;
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        betInfo = await solanaService.getUserBetInfo(
          betting.quest_key,
          betting.answer_key,
          betting.betting_address
        );

        if (betInfo.success && betInfo.betInfo.exists) {
          break;
        }

        lastError = betInfo.error || 'Bet not found on chain';
        console.log(`Bet verification attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      if (!betInfo.success) {
        return res.status(400).json(
          err({
            name: 'VerificationFailed',
            message: `Failed to verify bet on blockchain after ${MAX_RETRIES} attempts: ${lastError}`,
          })
        );
      }

      if (!betInfo.betInfo.exists) {
        return res.status(400).json(
          err({
            name: 'BetNotFoundOnChain',
            message:
              `Bet not found on Solana blockchain after ${MAX_RETRIES} attempts. Please ensure transaction was successful.`,
          })
        );
      }

      const onChainAmount = betInfo.betInfo.tokens;
      const expectedAmount = betting.betting_amount;

      if (onChainAmount !== expectedAmount) {
        console.warn(
          `Amount mismatch: DB=${expectedAmount}, Chain=${onChainAmount}`
        );
      }

      let updateValue = {
        betting_tx: bettingTx,
        betting_status: 1,
        solana_bet_tokens: betInfo.betInfo.tokens,
        solana_create_time: betInfo.betInfo.createTime,
        confirmed_at: new Date(),
      };

      await UpdateBetting(bettingKey, updateValue);
      let updatedBetting = await GetBetting(bettingKey);

      res.status(200).json(
        success(
          {
            ...updatedBetting.toJSON(),
            solana_bet_info: betInfo.betInfo,
          },
          'Betting confirmed successfully'
        )
      );
    } catch (e) {
      console.error('Error in confirmBetting:', e);
      res.status(400).json(err(e));
    }
  },

  claimBettingReward: async (req, res) => {
    try {
      const bettingKey = req.params.betting_key;
      const reward_tx = req.body.reward_tx;

      if (!reward_tx) {
        throw new MissingRequiredParameter('reward_tx is required');
      }

      let betting = await GetBetting(bettingKey);
      if (!betting)
        return res
          .status(401)
          .json(err({ name: null, message: 'Betting not found' }));
      if (betting.reward_claimed)
        return res
          .status(402)
          .json(
            err({ name: null, message: 'Betting reward is already claimed' })
          );

      const resolvedAvailableTokens
        = betting.solana_reward_tokens
        || betting.solana_bet_tokens
        || (betting.reward_amount
          ? String(betting.reward_amount)
          : betting.betting_amount
            ? String(betting.betting_amount)
            : '0');

      const receiveTransaction = {
        success: true,
        transaction: null,
      };

      let updateValue = {
        reward_tx: reward_tx,
        reward_claimed: true,
        reward_created_at: new Date(),
        solana_reward_tokens: resolvedAvailableTokens,
        solana_receive_transaction: receiveTransaction.transaction,
      };

      await UpdateBetting(bettingKey, updateValue);
      let updatedBetting = await GetBetting(bettingKey);

      res.status(200).json(
        success(
          {
            ...updatedBetting.toJSON(),
            available_tokens: resolvedAvailableTokens,
            solana_receive_transaction: receiveTransaction.transaction,
          },
          'Reward claim transaction created successfully! Please sign and send the transaction.'
        )
      );
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
  getBetting: async (req, res) => {
    try {
      if (!req.params.betting_key) throw new MissingRequiredParameter();
      let betting = await GetBetting(req.params.betting_key);
      res.status(200).json(success(betting, null));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  availableReceiveTokens: async (req, res) => {
    try {
      const { quest_key, answer_key, betting_address } = req.body;

      if (!quest_key || !answer_key || !betting_address) {
        throw new MissingRequiredParameter(
          'Missing required parameters: quest_key, answer_key, betting_address'
        );
      }

      validateWalletAddress(betting_address);

      const solanaService = getSolanaService();

      const availableTokens = await solanaService.getAvailableReceiveTokens(
        quest_key,
        answer_key,
        betting_address
      );

      if (!availableTokens.success) {
        return res
          .status(400)
          .json(err({ name: 'SolanaError', message: availableTokens.error }));
      }

      res.status(200).json(
        success(
          {
            quest_key,
            answer_key,
            betting_address,
            available_tokens: availableTokens.availableTokens,
          },
          'Available tokens retrieved successfully'
        )
      );
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  receiveToken: async (req, res) => {
    try {
      const { quest_key, answer_key, betting_address } = req.body;

      if (!quest_key || !answer_key || !betting_address) {
        throw new MissingRequiredParameter(
          'Missing required parameters: quest_key, answer_key, betting_address'
        );
      }

      validateWalletAddress(betting_address);

      const solanaService = getSolanaService();

      const availableTokens = await solanaService.getAvailableReceiveTokens(
        quest_key,
        answer_key,
        betting_address
      );

      if (!availableTokens.success) {
        return res
          .status(400)
          .json(err({ name: 'SolanaError', message: availableTokens.error }));
      }

      if (availableTokens.availableTokens === '0') {
        return res
          .status(400)
          .json(
            err({ name: 'NoReward', message: 'No tokens available to receive' })
          );
      }

      const receiveTransaction =
        await solanaService.createReceiveTokenTransaction(
          quest_key,
          answer_key,
          betting_address
        );

      if (!receiveTransaction.success) {
        return res
          .status(400)
          .json(
            err({ name: 'SolanaError', message: receiveTransaction.error })
          );
      }

      res.status(200).json(
        success(
          {
            quest_key,
            answer_key,
            betting_address,
            available_tokens: availableTokens.availableTokens,
            transaction: receiveTransaction.transaction,
          },
          'Receive token transaction created successfully! Please sign and send the transaction.'
        )
      );
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  getMarketInfo: async (req, res) => {
    try {
      const { quest_key } = req.params;

      if (!quest_key) {
        throw new MissingRequiredParameter('quest_key is required');
      }

      const solanaService = getSolanaService();

      const marketInfo = await solanaService.getMarketInfo(quest_key);

      if (!marketInfo.success) {
        return res
          .status(400)
          .json(err({ name: 'SolanaError', message: marketInfo.error }));
      }

      res
        .status(200)
        .json(
          success(marketInfo.marketInfo, 'Market info retrieved successfully')
        );
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  getUserBetInfo: async (req, res) => {
    try {
      const { quest_key, answer_key, betting_address } = req.body;

      if (!quest_key || !answer_key || !betting_address) {
        throw new MissingRequiredParameter(
          'Missing required parameters: quest_key, answer_key, betting_address'
        );
      }

      validateWalletAddress(betting_address);

      const solanaService = getSolanaService();

      const betInfo = await solanaService.getUserBetInfo(
        quest_key,
        answer_key,
        betting_address
      );

      if (!betInfo.success) {
        return res
          .status(400)
          .json(err({ name: 'SolanaError', message: betInfo.error }));
      }

      res.status(200).json(
        success(
          {
            quest_key,
            answer_key,
            betting_address,
            bet_info: betInfo.betInfo,
          },
          'User bet info retrieved successfully'
        )
      );
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
};
