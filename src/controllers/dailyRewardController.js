const { err, success } = require('../utils/responses');
const client = require('../database/client');
const validateWalletAddress = require('../validates/walletAddress');
const {
  standardizeToMidnight,
  getMonthDateRange,
} = require('../utils/timeHandler');
const isToday = require('../validates/dailyRewardTime');
const dailyRewardService = require('../services/dailyRewardService');

const handleError = async (error, data, res) => {
  if (error.message === 'Transaction timeout') {
    try {
      await client.DailyReward.CreatePending(data, error.transactionHash);
      return res.status(202).json(success('', 'Pending'));
    } catch (e) {
      return res.status(400).json(err(e));
    }
  }
  let errorCode = error?.statusCode ? error.statusCode : 400;
  return res.status(errorCode).json(err(error));
};

module.exports = {
  createDailyReward: async (req, res) => {
    let wallet_address = req.params.wallet_address;
    let { claimed_at } = req.body;
    let data;

    try {
      wallet_address = validateWalletAddress(wallet_address);
      claimed_at = standardizeToMidnight(claimed_at);
      isToday(claimed_at);

      await client.DailyReward.CheckRewardHistory(wallet_address, claimed_at);

      data = {
        wallet_address,
        claimed_at,
        amount: dailyRewardService.amount,
      };

      const result = await dailyRewardService.claimDailyReward(wallet_address);

      await client.DailyReward.CreateSuccess(
        wallet_address,
        claimed_at,
        dailyRewardService.amount,
        result.signature
      );

      return res.status(200).json(success('', 'Got Reward'));
    } catch (e) {
      handleError(e, data, res);
    }
  },

  listDailyReward: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      const { yearMonth } = req.query;

      const validatedWalletAddress = validateWalletAddress(wallet_address);
      const { startDate, endDate } = getMonthDateRange(yearMonth);

      const rewards = await client.DailyReward.ListByWalletAddress(
        validatedWalletAddress,
        startDate,
        endDate
      );

      return res.status(200).json(success(rewards));
    } catch (error) {
      return res.status(400).json(err(error));
    }
  },

  getDailyReward: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      let { claimed_at } = req.query;

      wallet_address = validateWalletAddress(wallet_address);
      claimed_at = standardizeToMidnight(claimed_at);
      const reward = await client.DailyReward.Get(wallet_address, claimed_at);

      return res.status(200).json(success(reward));
    } catch (error) {
      return res.status(400).json(err(error));
    }
  },
};
