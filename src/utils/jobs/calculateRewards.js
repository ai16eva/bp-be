const models = require('../../models/mysql');
const { where, Op } = require('sequelize');
const Quest = models.quests;
const Answer = models.answers;
const Betting = models.bettings;
const Season = models.seasons;
const Reward = models.rewards;
module.exports = {
    calculateRewards: async (req, res) => {
        try {
            const quests = await Quest.findAll({
                include: [
                    {
                        model: Answer,
                        as: 'answers',
                        attributes: [
                            'answer_key',
                            'answer_title',
                            'answer_selected',
                            'quest_key',
                            'answer_created_at',
                            [models.sequelize.literal('(SELECT COALESCE(SUM(betting_amount), 0) FROM bettings WHERE bettings.answer_key = answers.answer_key)'), 'total_betting_amount']
                        ],
                    },
                    {
                        model: Betting,
                        as: 'bettings',
                        where: { betting_status: 1 },
                        attributes: ['betting_key', 'betting_amount', 'answer_key', 'quest_key', 'betting_address'],
                    },
                    {
                        model: Season,
                        as: 'season'
                    }
                ],
                where: {
                    quest_status: 'MARKET_SUCCESS',
                    quest_reward_calculated: false
                },
                attributes: [
                    'quest_key',
                    'season_id',
                    'quest_category_id',
                    'quest_creator',
                    'quest_end_date',
                    'quest_end_date_utc',
                    'quest_status',
                    [
                        models.sequelize.literal(
                            '(SELECT COALESCE(SUM(betting_amount), 0) FROM bettings WHERE bettings.quest_key = quests.quest_key)'
                        ),
                        'total_betting_amount',
                    ],
                ],
            });
            if (quests) {
                for (const quest of quests) {
                    try {
                        if (quest.season) {
                            let quest_fee = quest.season.creator_fee + quest.season.charity_fee + quest.season.service_fee
                            let quest_reward = (quest.total_betting_amount * (100 - quest_fee)) / 100
                            let final_answer
                            quest.answers.forEach(answer => {
                                if (answer.answer_selected) {
                                    final_answer = answer
                                }
                            });
                            if (final_answer && final_answer.total_betting_amount > 0) {
                                for (const betting of quest.bettings) {
                                    if (betting.answer_key === final_answer.answer_key) {
                                        let rewardAmount = (betting.betting_amount / final_answer.total_betting_amount) * (quest_reward);
                                        
                                        await Betting.update(
                                            {reward_amount: rewardAmount},
                                            {
                                                where: {
                                                    betting_key: betting.betting_key,
                                                    answer_key: final_answer.answer_key
                                                }
                                            });
                                        
                                        try {
                                            const existingReward = await Reward.findOne({
                                                where: {
                                                    betting_key: betting.betting_key,
                                                    quest_key: quest.quest_key,
                                                }
                                            });
                                            
                                            if (!existingReward) {
                                                await Reward.create({
                                                    wallet_address: betting.betting_address,
                                                    quest_key: quest.quest_key,
                                                    answer_key: final_answer.answer_key,
                                                    betting_key: betting.betting_key,
                                                    reward_amount: rewardAmount,
                                                    reward_type: 'bettingReward',
                                                    reward_claimed: false,
                                                    reward_created_at: new Date(),
                                                });
                                            } else {
                                                await Reward.update(
                                                    {
                                                        reward_amount: rewardAmount,
                                                        reward_created_at: new Date(),
                                                    },
                                                    {
                                                        where: {
                                                            reward_key: existingReward.reward_key,
                                                        }
                                                    }
                                                );
                                            }
                                        } catch (rewardError) {
                                            console.error(`Failed to create reward record for betting ${betting.betting_key}:`, rewardError.message);
                                        }
                                    }
                                }
                                
                                if (quest.quest_creator && quest.total_betting_amount > 0) {
                                    try {
                                        const creatorFee = quest.season.creator_fee || 0;
                                        const creatorReward = (quest.total_betting_amount * creatorFee) / 100;
                                        
                                        if (creatorReward > 0) {
                                            const existingCreatorReward = await Reward.findOne({
                                                where: {
                                                    wallet_address: quest.quest_creator,
                                                    quest_key: quest.quest_key,
                                                    reward_type: 'creatorReward',
                                                }
                                            });
                                            
                                            if (!existingCreatorReward) {
                                                await Reward.create({
                                                    wallet_address: quest.quest_creator,
                                                    quest_key: quest.quest_key,
                                                    answer_key: null,
                                                    betting_key: null,
                                                    reward_amount: creatorReward,
                                                    reward_type: 'creatorReward',
                                                    reward_claimed: false,
                                                    reward_created_at: new Date(),
                                                });
                                            } else {
                                                await Reward.update(
                                                    {
                                                        reward_amount: creatorReward,
                                                        reward_created_at: new Date(),
                                                    },
                                                    {
                                                        where: {
                                                            reward_key: existingCreatorReward.reward_key,
                                                        }
                                                    }
                                                );
                                            }
                                        }
                                    } catch (creatorRewardError) {
                                        console.error(`Failed to create creator reward for quest ${quest.quest_key}:`, creatorRewardError.message);
                                    }
                                }
                                
                                if (quest.season.charity_fee > 0 && quest.total_betting_amount > 0) {
                                    try {
                                        const charityFee = quest.season.charity_fee || 0;
                                        const charityReward = (quest.total_betting_amount * charityFee) / 100;
                                        
                                        if (charityReward > 0) {
                                            const charityWallet = process.env.SOLANA_CHARITY_WALLET || 
                                                                  process.env.CHARITY_WALLET || 
                                                                  process.env.SOLANA_MASTER_WALLET_DEV || 
                                                                  process.env.SOLANA_MASTER_WALLET;
                                            
                                            if (charityWallet) {
                                                const existingCharityReward = await Reward.findOne({
                                                    where: {
                                                        wallet_address: charityWallet,
                                                        quest_key: quest.quest_key,
                                                        reward_type: 'charityReward',
                                                    }
                                                });
                                                
                                                if (!existingCharityReward) {
                                                    await Reward.create({
                                                        wallet_address: charityWallet,
                                                        quest_key: quest.quest_key,
                                                        answer_key: null,
                                                        betting_key: null,
                                                        reward_amount: charityReward,
                                                        reward_type: 'charityReward',
                                                        reward_claimed: false,
                                                        reward_created_at: new Date(),
                                                    });
                                                } else {
                                                    await Reward.update(
                                                        {
                                                            reward_amount: charityReward,
                                                            reward_created_at: new Date(),
                                                        },
                                                        {
                                                            where: {
                                                                reward_key: existingCharityReward.reward_key,
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        }
                                    } catch (charityRewardError) {
                                        console.error(`Failed to create charity reward for quest ${quest.quest_key}:`, charityRewardError.message);
                                    }
                                }
                                
                                if (quest.season.service_fee > 0 && quest.total_betting_amount > 0) {
                                    try {
                                        const serviceFee = quest.season.service_fee || 0;
                                        const serviceReward = (quest.total_betting_amount * serviceFee) / 100;
                                        
                                        if (serviceReward > 0) {
                                            const serviceWallet = process.env.SOLANA_SERVICE_FEE_WALLET || 
                                                                   process.env.SERVICE_FEE_WALLET || 
                                                                   process.env.SOLANA_MASTER_WALLET_DEV || 
                                                                   process.env.SOLANA_MASTER_WALLET;
                                            
                                            if (serviceWallet) {
                                                const existingServiceReward = await Reward.findOne({
                                                    where: {
                                                        wallet_address: serviceWallet,
                                                        quest_key: quest.quest_key,
                                                        reward_type: 'serviceReward',
                                                    }
                                                });
                                                
                                                if (!existingServiceReward) {
                                                    await Reward.create({
                                                        wallet_address: serviceWallet,
                                                        quest_key: quest.quest_key,
                                                        answer_key: null,
                                                        betting_key: null,
                                                        reward_amount: serviceReward,
                                                        reward_type: 'serviceReward',
                                                        reward_claimed: false,
                                                        reward_created_at: new Date(),
                                                    });
                                                } else {
                                                    await Reward.update(
                                                        {
                                                            reward_amount: serviceReward,
                                                            reward_created_at: new Date(),
                                                        },
                                                        {
                                                            where: {
                                                                reward_key: existingServiceReward.reward_key,
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        }
                                    } catch (serviceRewardError) {
                                        console.error(`Failed to create service reward for quest ${quest.quest_key}:`, serviceRewardError.message);
                                    }
                                }
                                await Quest.update(
                                    {quest_reward_calculated: true},
                                    {
                                        where: {
                                            quest_key: quest.quest_key
                                        }
                                    })
                            }
                        }
                    } catch (e) {
                        console.log(e)
                    }
                }
            }
        }catch(err){
            console.log(err)
        }
    }
};
