
const client = require('../database/client');
const {err, success} = require("../utils/responses");
module.exports = {
    getReferrals: async  (req, res) => {
        try {
            const count = req.query.count || 5;
            const fiveReferral = await client.Referral.getReferrals(count)
            res.status(200).json(success(fiveReferral, ''))
        } catch (e) {
            console.log(e)
            res.status(500).json(err(e));
        }
    },
    generateReferral: async  (req, res) => {
        const counter = await client.Referral.GenerateReferralCode()
        res.status(200).json(success(`Successfully generated referral codes for ${counter} addresses`))
    }
}