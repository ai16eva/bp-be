const { err, success } = require('../utils/responses');
const marketService = require('../services/marketService');
const { handleSolanaError } = require('../utils/solanaErrorHandler');

module.exports = {
  lockWalletAddress: async (req, res) => {
    try {
      const { user_wallet, owner_wallet } = req.body;
      const result = await marketService.lockWalletAddress(
        user_wallet,
        owner_wallet
      );
      res.status(200).json(success(result, 'Lock transaction created'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  unlockWalletAddress: async (req, res) => {
    try {
      const { user_wallet, owner_wallet } = req.body;
      const result = await marketService.unlockWalletAddress(
        user_wallet,
        owner_wallet
      );
      res.status(200).json(success(result, 'Unlock transaction created'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getMarketInfo: async (req, res) => {
    try {
      const { market_key } = req.params;
      const info = await marketService.getMarketInfo(market_key);
      res.status(200).json(success(info, null));
    } catch (e) {
      // Use improved error handling
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getMarketStatus: async (req, res) => {
    try {
      const { market_key } = req.params;
      const status = await marketService.getMarketStatus(market_key);
      res.status(200).json(success(status, null));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getAllMarkets: async (req, res) => {
    try {
      const markets = await marketService.getAllMarkets();
      res.status(200).json(success(markets, null));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getMarketFee: async (req, res) => {
    try {
      const { market_key } = req.params;
      const fee = await marketService.getMarketFee(market_key);
      res.status(200).json(success(fee, null));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getAnswerInfo: async (req, res) => {
    try {
      const { market_key, answer_key } = req.params;
      const info = await marketService.getAnswerInfo(market_key, answer_key);
      res.status(200).json(success(info, null));
    } catch (e) {
      // Use improved error handling
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  getUserBetInfo: async (req, res) => {
    try {
      const { market_key, wallet_address } = req.params;
      const { answer_key } = req.query;
      const info = await marketService.getUserBetInfo(
        wallet_address,
        market_key,
        answer_key
      );
      res.status(200).json(success(info, null));
    } catch (e) {
      // Use improved error handling
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  calculateWinnings: async (req, res) => {
    try {
      const { market_key, wallet_address } = req.params;
      const { answer_key } = req.query;
      const winnings = await marketService.calculateWinnings(
        wallet_address,
        market_key,
        answer_key
      );
      res.status(200).json(success(winnings, null));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },

  availableReceiveTokens: async (req, res) => {
    try {
      const { market_key, wallet_address } = req.params;
      const { answer_key } = req.query;
      const available = await marketService.availableReceiveTokens(
        wallet_address,
        market_key,
        answer_key
      );
      res.status(200).json(success(available, null));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      res.status(400).json(err(errorMessage || e));
    }
  },
};
