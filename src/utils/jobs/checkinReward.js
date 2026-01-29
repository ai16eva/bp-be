const client = require('../../database/client');
const model = require('../../models/mysql');
const Checkin = model.checkins
const {where, fn, col, Op} = require("sequelize");

module.exports = {
    rewardCheckins: async (count=5) => {
        try {
            const CheckinAction = new client.Checkin()
            const checkins = await CheckinAction.getCheckins(count)
            for (const checkin of checkins) {
                const wallet_address = checkin.wallet_address;
                const user = await Checkin.findOne({
                    where: where(
                        fn('LOWER', col('wallet_address')),
                        Op.eq,
                        fn('LOWER', wallet_address)
                    )
                })
                if (count === 5){
                    try {
                        await client.ActivityRewardActions.createActivityReward(wallet_address, 4, "CHECKIN_STREAK");
                        await Checkin.update(
                            {
                                checkin_streak: 0,
                            },
                            {
                                where: where(
                                    fn('LOWER', col('wallet_address')),
                                    Op.eq,
                                    fn('LOWER', wallet_address)
                                )
                            }
                        )
                    } catch (e) {
                        console.log(e)
                    }
                }
            }
        } catch (e){
            console.log(e)
        }
    }
}