const model = require('../models/mysql');
const ReferralCodes = model.referral_codes
const NotFound = require('../exceptions/NotFoundException');

module.exports = {
    getReferralCode: async (referralCode) => {
        const referral = await ReferralCodes.findOne({
            where: {referral_code: referralCode}
        })
        return referral;
    },
}