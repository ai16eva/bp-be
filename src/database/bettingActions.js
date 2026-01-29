const models = require('../models/mysql');
const MissingRequiredParameter = require("../exceptions/MissingRequiredParameter");
const sequelize = require("sequelize");
const BettingNotFound = require("../exceptions/betting/BettingNotFound");
const generateUniqueKey = require("../utils/uniquekey_generate"); // Adjust the path as needed
const Quest = models.quests;
const Answer = models.answers;
const Bettings = models.bettings;
const QuestCategory = models.quest_categories;
const Season = models.seasons;

const bettingActions = {
    CreateBetting: async (betting) => {
        if (!betting) throw new MissingRequiredParameter();
        let {
            quest_key,
            answer_key,
            betting_amount,
            betting_address
        } = betting
        if (
            !quest_key || !answer_key || !betting_amount
        ) throw new MissingRequiredParameter();

        // Check if a betting record already exists for this user, quest, and answer
        const existingBetting = await Bettings.findOne({
            where: {
                betting_address: betting_address,
                quest_key: quest_key,
                answer_key: answer_key
            }
        });

        if (existingBetting) {
            // Update existing betting record by adding the new amount
            const updatedAmount = parseFloat(existingBetting.betting_amount) + parseFloat(betting_amount);
            await Bettings.update(
                { betting_amount: updatedAmount },
                { where: { betting_key: existingBetting.betting_key } }
            );
            // Return the updated record
            return await Bettings.findOne({
                where: { betting_key: existingBetting.betting_key }
            });
        } else {
            // Create new betting record
            let betting_key = generateUniqueKey()
            betting.betting_key = betting_key
            const newBetting = await Bettings.create(betting);
            return newBetting;
        }
    },
    GetBetting: async (bettingKey) => {
        if (!bettingKey) throw new MissingRequiredParameter();
        let betting = await Bettings.findOne({
            where: { betting_key: bettingKey },
            include: [
                {
                    model: Quest,
                    as: 'quest'
                }
            ]
        }
        );
        if (!betting) throw new BettingNotFound();
        return betting;
    },
    UpdateBetting: async (betting_key, updateValue) => {
        await Bettings.update(
            updateValue,
            { where: { betting_key: betting_key } }
        )
    },
    MyBettings: async (wallet_address, page, size) => {
        const bettings = await Bettings.findAll({
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT SUM(b.betting_amount)
                            FROM bettings b
                            WHERE b.quest_key = bettings.quest_key
                            AND b.betting_status = 1
                        )`),
                        'total_betting_amount'
                    ],
                    [
                        sequelize.literal(`(
                            SELECT SUM(b.betting_amount)
                            FROM bettings b
                            WHERE b.quest_key = bettings.quest_key
                            AND b.answer_key = bettings.answer_key
                            AND b.betting_status = 1
                        )`),
                        'selected_betting_amount'
                    ]
                ]
            },
            where: { betting_address: wallet_address, betting_status: 1 },
            include: [
                {
                    model: Quest,
                    as: 'quest',
                    // attributes: ['quest_title', 'quest_status', 'quest_created_at', 'quest_success_datetime', 'quest_betting_token'],
                    include: [
                        {
                            model: Season,
                            as: 'season'
                        },
                        {
                            model: QuestCategory,
                            as: 'quest_category',
                        },
                    ],
                },
                {
                    model: Answer,
                    as: 'answer'
                },

            ],
            order: [
                [{ model: Quest, as: 'quest' }, 'quest_success_datetime', 'DESC']
            ],
            limit: size,
            offset: (page - 1) * size,
        });
        return bettings;
    }
}

module.exports = bettingActions;