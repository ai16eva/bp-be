const DailyRewardDuplicate = require('../exceptions/DailyRewardDuplicate');
const models = require('../models/mysql');
const DailyReward = models.daily_rewards;
const { Op } = require('sequelize');

const dailyRewardActions = {
  CreateSuccess: async (wallet_address, claimed_at, amount, tx) => {
    await DailyReward.create({
      wallet_address,
      claimed_at,
      daily_reward_amount: amount,
      daily_reward_tx: tx,
    });
  },
  CreatePending: async ({ wallet_address, claimed_at, amount }, tx) => {
    await DailyReward.create({
      wallet_address,
      claimed_at,
      daily_reawrd_amount: amount,
      daily_reward_tx: tx,
      daily_reward_pending: 1,
    });
  },

  ListByWalletAddress: async (wallet_address, startDate, endDate) => {
    const whereClause = {
      wallet_address: wallet_address,
    };

    if (startDate !== null && endDate !== null) {
      whereClause.claimed_at = {
        [Op.between]: [startDate, endDate],
      };
    }

    const rewards = await DailyReward.findAll({
      where: whereClause,
      order: [['claimed_at', 'ASC']],
    });

    return rewards;
  },
  CheckRewardHistory: async (wallet_address, claimed_at) => {
    const check = await DailyReward.findOne({ where: { wallet_address, claimed_at } });
    if (check && check.daily_reward_pending) throw new DailyRewardDuplicate('Daily reward is pending..');
    else if (check) throw new DailyRewardDuplicate();
  },
  Get: async (wallet_address, claimed_at) => {
    return await DailyReward.findOne({ where: { wallet_address, claimed_at } });
  },
};

module.exports = dailyRewardActions;
