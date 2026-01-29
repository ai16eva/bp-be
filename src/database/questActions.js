const models = require('../models/mysql');
const QuestNotFound = require('../exceptions/quest/QuestNotFound');
const InvalidQuestStatus = require('../exceptions/quest/InvalidQuestStatus');
const MissingRequiredParameter = require('../exceptions/MissingRequiredParameter');
const sequelize = require('sequelize');
const { Op, Sequelize } = require('sequelize');
const generateUniqueKey = require('../utils/uniquekey_generate');
const moment = require("moment"); // Adjust the path as needed
const Quest = models.quests;
const Answer = models.answers;
const Betting = models.bettings;
const QuestCategory = models.quest_categories;
const Season = models.seasons;
const questActions = {
  CreateQuest: async (quest, transaction) => {
    if (!quest) throw new QuestNotFound();
    let {
      quest_title,
      quest_description,
      quest_end_date,
      quest_end_date_utc,
      quest_creator,
      quest_betting_token,
      quest_image_url,
      quest_image_link,
      season_id,
      quest_category_id,
    } = quest;
    if (
      !quest_title ||
      !quest_description ||
      !quest_end_date ||
      !quest_end_date_utc ||
      !quest_creator ||
      !quest_betting_token ||
      (
        !quest_image_url &&
        !quest_image_link
      ) ||
      !season_id ||
      !quest_category_id
    ) {
      console.log('MissingRequiredParameter');
      throw new MissingRequiredParameter();
    }

    quest['quest_key'] = generateUniqueKey();
    const newQuest = await Quest.create(quest, { transaction: transaction });
    return newQuest;
  },

  UpdateStatus: async (quest_key, status) => {
    if (!quest_key) throw new MissingRequiredParameter();
    const quest = await Quest.findOne({ where: { quest_key } });
    if (!quest) throw new QuestNotFound();
    const prevStatus = quest.quest_status?.toUpperCase();
    const newStatus = status?.toUpperCase();

    // Define valid status transitions
    const validTransitions = {
      'DRAFT': ['APPROVE', 'REJECTED'],
      'APPROVE': ['PUBLISH', 'FINISH', 'REJECTED'],
      'PUBLISH': ['FINISH', 'REJECTED'],
      'FINISH': ['DAO_SUCCESS', 'ADJOURN'],
      'DAO_SUCCESS': ['MARKET_SUCCESS', 'ADJOURN'],
      'MARKET_SUCCESS': [], // Terminal state - cannot transition from here
      'ADJOURN': [], // Terminal state - cannot transition from here
      'REJECTED': [], // Terminal state - cannot transition from here
      'ONGOING': ['ONGOING', 'REJECTED'], // Special case
    };

    // Check if transition is valid
    if (prevStatus && validTransitions[prevStatus]) {
      if (!validTransitions[prevStatus].includes(newStatus)) {
        throw new InvalidQuestStatus(`Invalid status transition from ${prevStatus} to ${newStatus}`);
      }
    }

    // Additional business logic validations
    // Cannot downgrade from terminal states
    const terminalStates = ['MARKET_SUCCESS', 'ADJOURN', 'REJECTED'];
    if (terminalStates.includes(prevStatus) && prevStatus !== newStatus) {
      throw new InvalidQuestStatus(`Cannot change status from terminal state ${prevStatus}`);
    }

    await Quest.update(
      { quest_status: status },
      {
        where: { quest_key },
      }
    );
  },
  MustGetQuest: async (quest_key) => {
    const quest = await Quest.findOne({ where: { quest_key } });
    if (!quest) throw new QuestNotFound();
    return quest;
  },

  GetQuest: async (quest_key) => {
    const quest = await Quest.findOne({
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],
      // attributes: ['quest_key', 'quest_title', 'quest_description']
      where: { quest_key: quest_key },
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_finish_tx',
        'quest_finish_datetime',
        'quest_adjourn_tx',
        'quest_adjourn_datetime',
        'quest_success_tx',
        'quest_success_datetime',
        'quest_created_at',
        'quest_updated_at',
        'quest_archived_at',
        'dao_created_tx',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'dao_success_start_at',
        'dao_success_end_at',
        'dao_answer_start_at',
        'dao_answer_end_at',
        'quest_reward_calculated',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
          )`),
          'total_betting_amount',
        ],
      ],
    });
    return quest;
  },

  GetPagedQuests: async (page, pageSize, condition) => {
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_finish_tx',
        'quest_finish_datetime',
        'quest_adjourn_tx',
        'quest_adjourn_datetime',
        'quest_success_tx',
        'quest_success_datetime',
        'quest_created_at',
        'quest_updated_at',
        'quest_archived_at',
        'dao_created_tx',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'dao_success_start_at',
        'dao_success_end_at',
        'dao_answer_start_at',
        'dao_answer_end_at',
        'quest_reward_calculated',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
          )`),
          'total_betting_amount',
        ],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['quest_created_at', 'DESC']
      ],
      where: condition
    });
    return quests;
  },
  GetEndingSoon: async (page, pageSize, condition) => {
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_created_at',
        'quest_updated_at',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
            )`),
          'total_betting_amount',
        ],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      where: condition,
      order: [],
    });
    return quests;
  },
  GetPagedQuestsByStatusList: async (statusList, page, pageSize, condition) => {
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_finish_tx',
        'quest_finish_datetime',
        'quest_adjourn_tx',
        'quest_adjourn_datetime',
        'quest_success_tx',
        'quest_success_datetime',
        'quest_created_at',
        'quest_updated_at',
        'quest_archived_at',
        'dao_created_tx',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'dao_success_start_at',
        'dao_success_end_at',
        'dao_answer_start_at',
        'dao_answer_end_at',
        'quest_reward_calculated',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
            )`),
          'total_betting_amount',
        ],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      where: condition,
      order: [
        ['quest_created_at', 'DESC']
      ],
    });
    return quests;
  },

  UpdateQuest: async (quest_key, updateValue) => {
    await Quest.update(updateValue, { where: { quest_key: quest_key } });
  },
  GetQuestsByCategory: async (category_id, page, pageSize, condition) => {
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],

      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_finish_tx',
        'quest_finish_datetime',
        'quest_adjourn_tx',
        'quest_adjourn_datetime',
        'quest_success_tx',
        'quest_success_datetime',
        'quest_created_at',
        'quest_updated_at',
        'quest_archived_at',
        'dao_created_tx',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'dao_success_start_at',
        'dao_success_end_at',
        'dao_answer_start_at',
        'dao_answer_end_at',
        'quest_reward_calculated',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
          )`),
          'total_betting_amount',
        ],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      where: condition,
      order: [
        // Step 1: Put rows with column1 IS NULL first
        [Sequelize.literal('quest_finish_datetime IS NOT NULL'), 'ASC'],
        // Step 2: Apply conditional order on column2
        [Sequelize.literal(`
            CASE
              WHEN quest_finish_datetime IS NULL THEN quest_created_at
              ELSE NULL
            END
        `), 'ASC'],
        [Sequelize.literal(`
          CASE
            WHEN quest_finish_datetime IS NOT NULL THEN quest_created_at
            ELSE NULL
          END
        `), 'DESC'],
      ],
    });

    return quests;
  },
  GetQuestsByCategoryAndStatusList: async (category_id, statusList, page, pageSize, condition) => {
    console.log(statusList)
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
        {
          model: QuestCategory,
          as: 'quest_category',
        },
        {
          model: Season,
          as: 'season',
        },
      ],

      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_finish_tx',
        'quest_finish_datetime',
        'quest_adjourn_tx',
        'quest_adjourn_datetime',
        'quest_success_tx',
        'quest_success_datetime',
        'quest_created_at',
        'quest_updated_at',
        'quest_archived_at',
        'dao_created_tx',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'dao_success_start_at',
        'dao_success_end_at',
        'dao_answer_start_at',
        'dao_answer_end_at',
        'quest_reward_calculated',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
          )`),
          'total_betting_amount',
        ],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      where: condition,
      order: [
        // Step 1: Put rows with column1 IS NULL first
        [Sequelize.literal('quest_finish_datetime IS NOT NULL'), 'ASC'],
        // Step 2: Apply conditional order on column2
        [Sequelize.literal(`
            CASE
              WHEN quest_finish_datetime IS NULL THEN quest_created_at
              ELSE NULL
            END
        `), 'ASC'],
        [Sequelize.literal(`
          CASE
            WHEN quest_finish_datetime IS NOT NULL THEN quest_created_at
            ELSE NULL
          END
        `), 'DESC'],
        // [Sequelize.literal('IF(quest_finish_datetime IS NOT NULL, quest_created_at, quest_finish_datetime)'), 'DESC'],
      ],
    });

    return quests;
  },
  GetQuestsOnCarousel: async (page, pageSize) => {
    const quest = await Quest.findAll({
      attributes: ['quest_key', 'quest_title', 'quest_end_date', 'quest_image_url', 'quest_status'],
      where: {
        quest_hot: true,
        quest_status: {
          [Op.in]: ['PUBLISH', 'FINISH'],
        },
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        [models.sequelize.literal("CASE WHEN quest_status = 'PUBLISH' THEN 0 ELSE 1 END"), 'ASC'],
        ['quest_created_at', 'DESC'],
      ],
    });
    return quest;
  },
  GetQuestsOnPopular: async (page, pageSize, condition) => {
    const quests = await Quest.findAll({
      include: [
        {
          model: Answer,
          as: 'answers',
          attributes: [
            'answer_key',
            'answer_title',
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(betting_amount), 0)
                FROM bettings
                WHERE bettings.answer_key = answers.answer_key
                AND bettings.betting_status = 1
              )`),
              'total_betting_amount',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
      ],
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'season_id',
        'quest_category_id',
        'quest_creator',
        'quest_betting_token',
        'quest_betting_token_address',
        'quest_image_url',
        'quest_image_link',
        'quest_end_date',
        'quest_end_date_utc',
        'quest_hot',
        'quest_status',
        'quest_publish_tx',
        'quest_publish_datetime',
        'quest_created_at',
        'quest_updated_at',
        [
          models.sequelize.literal(`(
            SELECT COALESCE(SUM(betting_amount), 0)
            FROM bettings
            WHERE bettings.quest_key = quests.quest_key
            AND bettings.betting_status = 1
          )`),
          'total_betting_amount',
        ],
      ],
      where: condition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [[models.sequelize.literal('total_betting_amount'), 'DESC']],
    });
    return quests;
  },
  GetQuestCountBySeasonAndCategory: async () => {
    const result = await Quest.findAll({
      attributes: [
        'season_id',
        'quest_category_id',
        [sequelize.fn('COUNT', sequelize.col('quest_key')), 'quest_count'],
      ],
      include: [
        {
          model: QuestCategory,
          as: 'quest_category',
          attributes: ['quest_category_title', 'quest_category_id', 'quest_category_order'],
        },
        {
          model: Season,
          as: 'season',
          attributes: { exclude: [] },
        },
      ],
      group: ['season_id', 'quest_category_id', 'quest_category.quest_category_title', 'season.season_title'],
      raw: true,
      nest: true,
    });

    const groupedResult = Object.values(
      result.reduce((acc, curr) => {
        if (!acc[curr.season_id]) {
          acc[curr.season_id] = {
            ...curr.season,
            quest_categories: [],
          };
        }
        acc[curr.season_id].quest_categories.push({
          quest_category_id: curr.quest_category.quest_category_id,
          quest_category_title: curr.quest_category.quest_category_title,
          quest_category_order: curr.quest_category.quest_category_order,
          quest_count: parseInt(curr.quest_count),
        });
        return acc;
      }, {})
    );

    groupedResult.forEach((season) => {
      season.quest_categories.sort((a, b) => a.quest_category_order - b.quest_category_order);
    });

    return groupedResult;
  },

  GetQuestBettings: async (quest_key, page, size) => {
    const bettings = await Betting.findAll({
      where: { quest_key: quest_key, betting_status: 1 },
      include: [
        {
          model: Quest,
          as: 'quest',
        },
      ],
      limit: size,
      offset: (page - 1) * size,
    });
    return bettings;
  },

  UpdateQuestHot: async (quest_key) => {
    const quest = await Quest.findOne({ where: { quest_key } });
    if (!quest) throw new QuestNotFound();
    let cond = quest.quest_hot ? false : true;
    await quest.update({ quest_hot: cond });
  },
  TotalQuestCount: async (condition) => {
    const count = await Quest.count({ where: condition });
    return count;
  },
};

module.exports = questActions;
