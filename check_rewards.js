require('dotenv').config();
const models = require('./src/models/mysql');
const ActivityReward = models.activity_rewards;

async function checkPendingRewards() {
    try {
        const pending = await ActivityReward.findAll({ where: { rewarded_at: null } });
        console.log(`Found ${pending.length} pending rewards:`);
        pending.forEach(r => {
            console.log(`ID: ${r.id}, Wallet: ${r.wallet_address}, Amount: ${r.reward_amount}, Type: ${r.reward_type}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error checking rewards:', error);
        process.exit(1);
    }
}

checkPendingRewards();
