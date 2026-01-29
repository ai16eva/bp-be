const MemberDuplicate = require('../exceptions/MemberDuplicate');
const MemberNotFound = require('../exceptions/MemberNotFound');

const models = require('../models/mysql');// Adjust the path as needed
const {Op, fn, col, where} = require("sequelize");
const generateRandomString = require("../utils/generate_referral_code");
const ActivityReward = models.activity_rewards;
const Members = models.members;

const ActivityRewardActions = {
    createActivityReward: async (wallet_address, reward_amount, reward_type) => {
        const user = await Members.findOne({ where: { wallet_address } });
        if (!user) throw new MemberNotFound('Wallet address duplicate');
        const dto = {
            wallet_address: wallet_address,
            reward_amount: reward_amount,
            reward_type: reward_type,
        };
        const newReward = await ActivityReward.create(dto);

        return newReward;
    },
    getNotRewarded: async () => {
        let notRewarded = await ActivityReward.findAll({ where: { rewarded_at: null } });
        return notRewarded;
    },
    updateRewardDate: async (id, reward_tx) => {
        try {
           ActivityReward.update(
               {
                   reward_tx:reward_tx,
                   rewarded_at: new Date()
               },
               {
                   where: { id: id}
               },
           );
        } catch (e) {
            console.log(e)
        }
    }
}

module.exports = ActivityRewardActions;