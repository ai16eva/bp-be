const validateWalletAddress = require('../validates/walletAddress');
const { err, success } = require('../utils/responses');
const client = require('../database/client');
const Checkin = new client.Checkin();
const { logger } = require('sequelize/lib/utils/logger');

const { Sequelize } = require('sequelize');
module.exports = {
  checkin: async (req, res) => {
    try {
      const { wallet_address } = req.params;
      validateWalletAddress(wallet_address);
      const checkin = await Checkin.getCheckinOrNull(wallet_address);
      if (!checkin) {
        await Checkin.createCheckin(wallet_address);
      } else {
        await Checkin.updateLastCheck(wallet_address);
      }
      try {
        await client.ActivityRewardActions.createActivityReward(
          wallet_address,
          1,
          'DAILY_CHECKIN'
        );
      } catch (e) {
        logger.error(e);
      }

      const newCheckin = await Checkin.getCheckin(wallet_address);
      return res.status(200).send(success(newCheckin));
    } catch (e) {
      res.status(e.status || 400).json(err(e));
    }
  },
  getCheckin: async (req, res) => {
    try {
      const { wallet_address } = req.params;
      validateWalletAddress(wallet_address);

      const checkin = await Checkin.getCheckinOrNull(wallet_address);

      const models = require('../models/mysql');
      const sequelize = models.sequelize;
      const [todayRewards] = await sequelize.query(
        `
            SELECT * FROM daily_rewards
            WHERE wallet_address = :wallet_address
            AND DATE(claimed_at) = CURDATE()
            LIMIT 1
        `,
        {
          replacements: { wallet_address },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      const todayReward = todayRewards || null;
      const responseData = {
        wallet_address,
        last_checkin_date: checkin?.last_checkin_date || null,
        checkin_streak: checkin?.checkin_streak || 0,
        checkin_total: checkin?.checkin_total || 0,
        daily_reward_id: todayReward?.daily_reward_id || null,
        checked_in_today: !!todayReward,
        daily_reward_pending: todayReward?.daily_reward_pending || false,
      };

      res.status(200).json(success(responseData));
    } catch (e) {
      res.status(e.status || 400).json(err(e));
    }
  },
};
