const models = require('../models/mysql'); // Adjust the path as needed
const Quest = models.quests;
const { Op } = require('sequelize');
const questListActions = {
  draftListAtDaoPage: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: 'DRAFT',
        quest_archived_at: null,
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'quest_status',
        'quest_image_url',
        'quest_created_at',
        'quest_end_date',
        'dao_draft_start_at',
        'dao_draft_end_at',
        'quest_start_block',
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_draft_option = 'APPROVE' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_approve_power',
        ],
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_draft_option = 'REJECT' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_reject_power',
        ],
      ],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.votes,
          as: 'votes',
          attributes: [],
          required: false,
        },
        {
          model: models.answers,
          as: 'answers',
          attributes: ['answer_key', 'answer_title'],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
      ],
      where: {
        quest_status: 'DRAFT',
        quest_archived_at: null,
      },
      group: ['quests.quest_key'],
      limit: limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });
    const formattedQuests = rows.map((quest) => {
      const total_approve_power = parseInt(quest.get('total_approve_power')) || 0;
      const total_reject_power = parseInt(quest.get('total_reject_power')) || 0;

      return {
        quest_key: quest.quest_key,
        quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
        quest_title: quest.quest_title,
        quest_description: quest.quest_description,
        quest_status: quest.quest_status,
        quest_image_url: quest.quest_image_url,
        quest_created_at: quest.quest_created_at,
        quest_end_date: quest.quest_end_date,
        dao_draft_start_at: quest.dao_draft_start_at,
        dao_draft_end_at: quest.dao_draft_end_at,
        quest_start_block: quest.quest_start_block,
        total_approve_power,
        total_reject_power,
        total_vote: total_approve_power + total_reject_power,
        answers: quest.answers.map((answer) => ({
          answer_key: answer.answer_key,
          answer_title: answer.answer_title,
        })),
      };
    });

    return { total: count, quests: formattedQuests };
  },

  successListAtDaoPage: async (limit = 10, offset = 1) => {
    try {
      const count = await Quest.count({
        where: {
          quest_status: 'FINISH',
          dao_success_tx: {
            [Op.ne]: null,
          },
        },
      });
      const rows = await Quest.findAll({
        attributes: [
          'quest_key',
          'quest_title',
          'quest_description',
          'quest_status',
          'quest_image_url',
          'quest_created_at',
          'quest_end_date',
          'dao_success_start_at',
          'dao_success_end_at',
          [
            models.sequelize.literal(`(
              SELECT COALESCE(SUM(vote_power), 0)
              FROM votes
              WHERE votes.quest_key = quests.quest_key
              AND votes.vote_draft_option = 'APPROVE'
            )`),
            'total_approve_power',
          ],
          [
            models.sequelize.literal(`(
              SELECT COALESCE(SUM(vote_power), 0)
              FROM votes
              WHERE votes.quest_key = quests.quest_key
              AND votes.vote_draft_option = 'REJECT'
            )`),
            'total_reject_power',
          ],
          [
            models.sequelize.fn(
              'SUM',
              models.sequelize.literal(
                `CASE WHEN votes.vote_success_option = 'SUCCESS' THEN votes.vote_power ELSE 0 END`
              )
            ),
            'total_success_power',
          ],
          [
            models.sequelize.fn(
              'SUM',
              models.sequelize.literal(
                `CASE WHEN votes.vote_success_option = 'ADJOURN' THEN votes.vote_power ELSE 0 END`
              )
            ),
            'total_adjourn_power',
          ],
        ],
        include: [
          {
            model: models.answers,
            as: 'answers',
            attributes: [
              'answer_key',
              'answer_title',
              'answer_selected',
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
            model: models.votes,
            as: 'votes',
            attributes: [],
            required: false,
          },
        ],
        where: {
          quest_status: 'FINISH',
          dao_success_tx: {
            [Op.ne]: null,
          },
        },
        group: ['quests.quest_key'],
        limit,
        offset: (offset - 1) * limit,
        order: [['quest_created_at', 'DESC']],
        subQuery: false,
      });

      const formattedQuests = rows.map((quest) => {
        const total_success_power = parseInt(quest.get('total_success_power')) || 0;
        const total_adjourn_power = parseInt(quest.get('total_adjourn_power')) || 0;
        const total_approve_power = parseInt(quest.get('total_approve_power')) || 0;
        const total_reject_power = parseInt(quest.get('total_reject_power')) || 0;

        return {
          quest_key: quest.quest_key,
          quest_title: quest.quest_title,
          quest_description: quest.quest_description,
          quest_status: quest.quest_status,
          quest_image_url: quest.quest_image_url,
          quest_created_at: quest.quest_created_at,
          quest_end_date: quest.quest_end_date,
          dao_success_start_at: quest.dao_success_start_at,
          dao_success_end_at: quest.dao_success_end_at,
          total_success_power,
          total_adjourn_power,
          total_approve_power,
          total_reject_power,
          total_vote: total_success_power + total_adjourn_power,
          total_draft_vote: total_approve_power + total_reject_power,
          answers: quest.answers.map((answer) => ({
            answer_key: answer.answer_key,
            answer_title: answer.answer_title,
            answer_selected: answer.answer_selected,
            total_betting_amount: parseFloat(answer.get('total_betting_amount')) || 0,
          })),
        };
      });

      return { total: count, quests: formattedQuests };
    } catch (error) {
      console.error('Error in successListAtDaoPage:', error);
      throw error;
    }
  },
  answerListAtDaoPage: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: 'DAO_SUCCESS',
        dao_answer_tx: {
          [Op.ne]: null,
        },
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_description',
        'quest_status',
        'quest_image_url',
        'quest_created_at',
        'quest_end_date',
        'dao_answer_start_at',
        'dao_answer_end_at',
      ],
      include: [
        {
          model: models.answers,
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
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(vote_power), 0)
                FROM votes
                WHERE votes.quest_answer_key = answers.answer_key
              )`),
              'total_answer_vote_power',
            ],
          ],
          separate: true,
          order: [['answer_key', 'ASC']],
        },
      ],
      where: {
        quest_status: 'DAO_SUCCESS',
        dao_answer_tx: {
          [Op.ne]: null,
        },
      },
      limit,
      offset: (offset - 1) * limit,
      group: ['quests.quest_key', 'answers.answer_key'],
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    const formattedQuests = rows.map((quest) => {
      const plainQuest = quest.get({ plain: true });
      return {
        quest_key: plainQuest.quest_key,
        quest_title: plainQuest.quest_title,
        quest_description: plainQuest.quest_description,
        quest_status: plainQuest.quest_status,
        quest_image_url: plainQuest.quest_image_url,
        quest_created_at: plainQuest.quest_created_at,
        quest_end_date: plainQuest.quest_end_date,
        dao_answer_start_at: plainQuest.dao_answer_start_at,
        dao_answer_end_at: plainQuest.dao_answer_end_at,
        answers: plainQuest.answers.map((answer) => ({
          answer_key: answer.answer_key,
          answer_title: answer.answer_title,
          total_betting_amount: parseFloat(answer.total_betting_amount) || 0,
          total_answer_vote_power: parseInt(answer.total_answer_vote_power) || 0,
        })),
      };
    });

    return { total: count, quests: formattedQuests };
  },
  onGoingList: async (limit = 10, offset = 1) => {
    const { count, rows } = await Quest.findAndCountAll({
      attributes: ['quest_key', 'quest_title', 'quest_hot', 'quest_status', 'quest_end_date'],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
      ],
      where: {
        quest_status: {
          [Op.notIn]: ['REJECT', 'ADJOURN', 'MARKET_SUCCESS'],
        },
        quest_archived_at: null,
      },
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
    });
    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => ({
      quest_key: quest.quest_key,
      quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
      quest_hot: quest.quest_hot,
      quest_title: quest.quest_title,
      quest_end_date: quest.quest_end_date,
      quest_status: quest.quest_status,
    }));

    return { total: count, quests: formattedQuests };
  },
  draftList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: {
          [Op.in]: ['DRAFT', 'APPROVE'],
        },
        quest_archived_at: null,
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_status',
        'dao_draft_end_at',
        'quest_betting_token',
        'quest_betting_token_address',
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_draft_option = 'APPROVE' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_approve_power',
        ],
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_draft_option = 'REJECT' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_reject_power',
        ],
      ],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.votes,
          as: 'votes',
          attributes: [],
          required: false,
        },
      ],
      where: {
        quest_status: {
          [Op.in]: ['DRAFT', 'APPROVE'],
        },
        quest_archived_at: null,
      },
      group: ['quests.quest_key'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    const formattedQuests = rows.map((quest) => {
      const total_approve_power = parseInt(quest.get('total_approve_power')) || 0;
      const total_reject_power = parseInt(quest.get('total_reject_power')) || 0;

      return {
        quest_key: quest.quest_key,
        quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
        quest_title: quest.quest_title,
        dao_draft_end_at: quest.dao_draft_end_at,
        quest_status: quest.quest_status,
        total_approve_power,
        total_reject_power,
        total_vote: total_approve_power + total_reject_power,
      };
    });

    return { total: count, quests: formattedQuests };
  },
  publishList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: {
          [Op.in]: ['PUBLISH', 'FINISH'],
        },
        dao_success_tx: null,
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_end_date',
        'quest_status',
        'quest_betting_token',
        'quest_betting_token_address',
        [
          models.sequelize.literal(
            'SUM(CASE WHEN bettings.betting_status = 1 THEN bettings.betting_amount ELSE 0 END)'
          ),
          'total_betting_amount',
        ],
      ],
      include: [
        {
          model: models.bettings,
          as: 'bettings',
          attributes: [],
          required: false, // LEFT JOIN을 사용하여 베팅이 없는 퀘스트도 포함
        },
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
      ],
      where: {
        quest_status: {
          [Op.in]: ['PUBLISH', 'FINISH'],
        },
        dao_success_tx: null,
      },
      group: ['quests.quest_key'], // quest_key로 그룹화
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => ({
      quest_key: quest.quest_key,
      quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
      quest_title: quest.quest_title,
      quest_end_date: quest.quest_end_date,
      total_betting_amount: parseFloat(quest.get('total_betting_amount')) || 0,
      quest_status: quest.quest_status,
    }));

    return { total: count, quests: formattedQuests };
  },
  deicisionList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: 'FINISH',
        dao_success_tx: {
          [Op.ne]: null,
        },
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_status',
        'dao_success_end_at',
        'quest_betting_token',
        'quest_betting_token_address',
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_success_option = 'SUCCESS' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_success_power',
        ],
        [
          models.sequelize.fn(
            'SUM',
            models.sequelize.literal(`CASE WHEN votes.vote_success_option = 'ADJOURN' THEN votes.vote_power ELSE 0 END`)
          ),
          'total_adjourn_power',
        ],
      ],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.votes,
          as: 'votes',
          attributes: [],
          required: false,
        },
      ],
      where: {
        quest_status: 'FINISH',
        dao_success_tx: {
          [Op.ne]: null,
        },
      },
      group: ['quests.quest_key'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });
    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => {
      const total_success_power = parseInt(quest.get('total_success_power')) || 0;
      const total_adjourn_power = parseInt(quest.get('total_adjourn_power')) || 0;
      return {
        quest_key: quest.quest_key,
        quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
        quest_title: quest.quest_title,
        quest_status: quest.quest_status,
        dao_success_end_at: quest.dao_success_end_at,
        total_success_power,
        total_adjourn_power,
        total_vote: total_success_power + total_adjourn_power,
      };
    });
    return { total: count, quests: formattedQuests };
  },

  answerList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: 'DAO_SUCCESS',
      },
    });
    const rows = await Quest.findAll({
      attributes: ['quest_key', 'quest_title', 'quest_status', 'dao_answer_end_at', 'quest_betting_token'],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.answers,
          as: 'answers',
          attributes: [
            'answer_key',
            'answer_title',
            'answer_selected',
            [
              models.sequelize.literal(`(
                SELECT COALESCE(SUM(v.vote_power), 0)
                FROM votes AS v
                WHERE v.quest_answer_key = answers.answer_key
              )`),
              'vote_power'
            ],
          ],
          required: false,
          separate: true,
          order: [['answer_key', 'ASC']],
        },
      ],
      where: {
        quest_status: 'DAO_SUCCESS',
      },
      group: ['quests.quest_key'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => {
      const selectedAnswer = quest.answers.find((answer) => answer.answer_selected);
      const answers = quest.answers.map((answer) => ({
        answer_title: answer.answer_title,
        vote_power: parseInt(answer.get('vote_power')) || 0,
        answer_key: answer.answer_key,
      }));

      const total_vote = answers.reduce((sum, answer) => sum + answer.vote_power, 0);

      return {
        quest_key: quest.quest_key,
        quest_title: quest.quest_title,
        quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
        quest_status: quest.quest_status,
        dao_answer_end_at: quest.dao_answer_end_at,
        quest_betting_token: quest.quest_betting_token,
        quest_betting_token_address: quest.quest_betting_token_address,
        answer_selected: selectedAnswer ? selectedAnswer.answer_title : null,
        total_vote,
        answers,
      };
    });

    return { total: count, quests: formattedQuests };
  },
  successList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: 'MARKET_SUCCESS',
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_status',
        'quest_end_date',
        'quest_betting_token',
        'quest_betting_token_address',
        [
          models.sequelize.literal(`(
              SELECT SUM(CASE WHEN quest_answer_key IS NOT NULL THEN vote_power ELSE 0 END)
              FROM votes
              WHERE votes.quest_key = quests.quest_key
            )`),
          'total_vote',
        ],
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
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.votes,
          as: 'votes',
          attributes: [],
          required: false,
        },
        {
          model: models.bettings,
          as: 'bettings',
          attributes: [],
          required: false,
        },
      ],
      where: {
        quest_status: 'MARKET_SUCCESS',
      },
      group: ['quests.quest_key'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });
    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => ({
      quest_key: quest.quest_key,
      quest_title: quest.quest_title,
      quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
      quest_end_date: quest.quest_end_date,
      quest_betting_token: quest.quest_betting_token,
      total_vote: parseInt(quest.get('total_vote')) || 0,
      total_betting_amount: parseFloat(quest.get('total_betting_amount')) || 0,
      quest_status: quest.quest_status,
    }));

    return { total: count, quests: formattedQuests };
  },
  adjournList: async (limit = 10, offset = 1) => {
    const count = await Quest.count({
      where: {
        quest_status: {
          [Op.in]: ['ADJOURN', 'REJECT'],
        },
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_status',
        'quest_end_date',
        'quest_betting_token',
        'quest_betting_token_address',
        [
          models.sequelize.literal(
            'SUM(CASE WHEN bettings.betting_status = 1 THEN bettings.betting_amount ELSE 0 END)'
          ),
          'total_betting_amount',
        ],
      ],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.bettings,
          as: 'bettings',
          attributes: [],
          required: false,
        },
      ],
      where: {
        quest_status: {
          [Op.in]: ['ADJOURN', 'REJECT'],
        },
      },
      group: ['quests.quest_key'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => ({
      quest_key: quest.quest_key,
      quest_title: quest.quest_title,
      quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
      quest_end_date: quest.quest_end_date,
      total_betting_amount: parseFloat(quest.get('total_betting_amount')) || 0,
      quest_status: quest.quest_status,
      quest_betting_token: quest.quest_betting_token,
    }));

    return { total: count, quests: formattedQuests };
  },
  pendingList: async (limit = 10, offset = 1) => {
    const quest_count = await Quest.count({
      where: {
        quest_pending: true,
      },
    });
    const answer_count = await models.answers.count({
      where: {
        answer_pending: true,
      },
    });
    const rows = await Quest.findAll({
      attributes: [
        'quest_key',
        'quest_title',
        'quest_end_date',
        'quest_status',
        'quest_pending',
        [
          models.sequelize.literal(`CASE WHEN MAX(answers.answer_pending) = true THEN true ELSE false END`),
          'answer_pending',
        ],
      ],
      include: [
        {
          model: models.quest_categories,
          as: 'quest_category',
          attributes: ['quest_category_title'],
        },
        {
          model: models.answers,
          as: 'answers',
          attributes: [],
          required: false,
        },
      ],
      where: {
        [Op.or]: [{ quest_pending: true }, { '$answers.answer_pending$': true }],
      },
      group: ['quests.quest_key', 'quest_category.quest_category_id'],
      limit,
      offset: (offset - 1) * limit,
      order: [['quest_created_at', 'DESC']],
      subQuery: false,
    });

    // 결과 포맷팅
    const formattedQuests = rows.map((quest) => ({
      quest_key: quest.quest_key,
      quest_category: quest.quest_category ? quest.quest_category.quest_category_title : null,
      quest_title: quest.quest_title,
      quest_end_date: quest.quest_end_date,
      quest_status: quest.quest_status,
      answer_pending: quest.get('answer_pending'),
      quest_pending: quest.quest_pending,
    }));

    return {
      total: quest_count + answer_count,
      quests: formattedQuests,
    };
  },
};

module.exports = questListActions;
