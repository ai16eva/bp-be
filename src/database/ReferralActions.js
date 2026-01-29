const models = require('../models/mysql');
const generateReferralCode = require("../utils/generate_referral_code");
const NotFound = require("../exceptions/NotFoundException");
const {Sequelize, Op, where, fn, col} = require("sequelize");
const ReferralCodes = models.referral_codes
const Referrals = models.referrals
const Members = models.members
const referralActions = {

    GenerateReferralCode: async () => {
        try {
            const members = await Members.findAll({});
            let counter = 0;
            for (const member of members) {
                const wallet_address = member.wallet_address;
                try{
                    const referralCode = await ReferralCodes.findOne({
                        where: where(
                            fn('LOWER', col('wallet_address')),
                            Op.eq,
                            fn('LOWER', member.wallet_address),
                        )
                    })
                    if (!referralCode) {
                        let referral_code = generateReferralCode();
                        let dto = {
                            wallet_address,
                            referral_code,
                        }
                        await ReferralCodes.create(dto)
                        counter++;
                    }
                } catch (e) {
                    console.log(e)
                }
            }
            return counter;
        } catch (e) {

        }
    },
    /**
     * @param wallet_address
     * @param referral_code
     * @returns {Promise<void>}
     */
    createReferralCode: async (wallet_address) => {
        try {
            let referral_code = generateReferralCode();
            let dto = {
                wallet_address,
                referral_code,
            }
            await ReferralCodes.create(dto)
        } catch (e) {
            console.log(e)
        }

    },
    /**
     * @param wallet_address
     * @param referral_code
     * @returns {Promise<void>}
     */
    createReferral: async (wallet_address, referral_code) => {
        try {
            let dto = {
                wallet_address,
                referral_code,
            }
            await Referrals.create(dto)
        } catch (err) {
            console.log(err)
        }
    },
    /**
     *
     * @param wallet_address
     * @returns {Promise<Model|null>}
     */
    getReferralCode: async (wallet_address) => {
        const referralCodes = await ReferralCodes.findOne({
            where: where(
                fn('LOWER', col('wallet_address')),
                Op.eq,
                fn('LOWER', wallet_address)
            )
        })
        if (!referralCodes) throw new NotFound(`Referral code of '${wallet_address}' `)
        return referralCodes
    },
    getReferrals: async (count=5) => {
        try {
            const result = await ReferralCodes.findAll({
                /*include: [{
                    model: Referrals,
                    as: 'referrals',
                }],
                where: {
                    five_referral_rewarded_at: { [Op.is]: null } // Check if five_referral_rewarded_at is null
                },*/
                include: [{
                    model: Referrals,
                    as: "referrals",
                    required: true, // Ensures only referral_codes with referrals are included
                    attributes: [] // We don't need any attributes from the referrals table here
                }],
                attributes: [
                    'wallet_address',
                    'referral_code',
                    [Sequelize.fn('COUNT', Sequelize.col('referrals.wallet_address')), 'referral_count'] // Count the referrals for each referral_code
                ],
                group: ['referral_codes.wallet_address', 'referral_codes.referral_code'], // Group by wallet_address and referral_code
                having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('referrals.wallet_address')), {
                    [Op.gte]: count // Filter for referral_codes with 5 or more referrals
                })
            });
            return result
        } catch (e) {
            throw e
        }
    }
}

module.exports = referralActions;