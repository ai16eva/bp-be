const AnswerNotFound = require('../exceptions/AnswerNotFound');
const ForbiddenAccess = require('../exceptions/ForbiddenAccess');
const VoteDuplicate = require('../exceptions/VoteDuplicate');
const VoteNotFound = require('../exceptions/VoteNotFound');
const models = require('../models/mysql'); // Adjust the path as needed
const { Op } = require('sequelize');
const Vote = models.votes;

const voteActions = {
  Create: async (quest_key, data) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: data.voter } });
    if (vote) return;

    const createDTO = {
      quest_key,
      vote_voter: data.voter,
      vote_power: data.power,
    };

    // Handle draft vote
    if (data.option && !data.vote_success_option) {
      createDTO.vote_draft_option = data.option;
      createDTO.vote_draft_tx = data.tx || 'pending';
    }

    // Handle success vote
    if (data.vote_success_option) {
      createDTO.vote_success_option = data.vote_success_option;
      createDTO.vote_success_tx = data.vote_success_tx || 'pending';
    }

    // Handle answer vote
    if (data.quest_answer_key) {
      createDTO.quest_answer_key = data.quest_answer_key;
      createDTO.vote_answer_tx = data.vote_answer_tx || 'pending';
    }

    await Vote.create(createDTO);
  },

  Get: async (quest_key, vote_voter) => {
    return await Vote.findOne({ where: { quest_key, vote_voter } });
  },

  List: async (offset, limit) => {
    const votes = await Vote.findAll({
      order: [['vote_created_at', 'DESC']],
      limit: limit,
      offset: offset,
    });

    return votes;
  },

  UpdateReward: async (quest_key, voter, reward) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: voter } });
    if (!vote) throw new VoteNotFound();
    if (vote.vote_reward) return;

    await vote.update({ vote_reward: reward });
  },

  UpdateSuccess: async (quest_key, voter, data) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: voter } });
    if (!vote) throw new VoteNotFound();
    if (vote.vote_success_tx && vote.vote_success_tx !== 'pending') return;

    const updateDTO = {
      vote_success_tx: data.tx,
      vote_success_option: data.option,
    };

    await vote.update(updateDTO);
  },

  UpdateAnswer: async (quest_key, voter, data) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: voter } });
    if (!vote) throw new VoteNotFound();
    if (vote.vote_answer_tx && vote.vote_answer_tx !== 'pending') return;
    const updateDTO = {
      vote_answer_tx: data.tx,
      quest_answer_key: data.answer_key,
    };

    await vote.update(updateDTO);
  },

  Archive: async (quest_key, voter) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: voter } });

    if (!vote) {
      throw new VoteNotFound();
    }

    await vote.update({ vote_archived_at: new Date() });
  },

  Unarchive: async (quest_key, voter) => {
    const vote = await Vote.findOne({ where: { quest_key, vote_voter: voter } });

    if (!vote) {
      throw new VoteNotFound();
    }

    await vote.update({ vote_archived_at: null });
  },

  getHighestVotepowerAnswers: async (quest_key) => {
    const data = await Vote.findAll({
      attributes: [
        'quest_answer_key',
        [models.sequelize.fn('SUM', models.sequelize.col('vote_power')), 'total_votepower'],
      ],
      where: {
        quest_key: quest_key,
        quest_answer_key: {
          [Op.ne]: null,
        },
      },
      group: ['quest_answer_key'],
      order: [[models.sequelize.fn('SUM', models.sequelize.col('vote_power')), 'DESC']],
    });

    const results = data.map((result) => ({
      quest_answer_key: result.dataValues.quest_answer_key,
      total_votepower: parseInt(result.dataValues.total_votepower, 10), // Convert to integer
    }));

    if (!results.length) throw new AnswerNotFound('Could not found highest total vote Answerkey');
    if (results[0].total_votepower < 0) throw new AnswerNotFound('The number of highest total vote is under 0');
    return results;
  },

  listVoteByVoter: async (voter, limit, offset) => {
    try {
      const { count, rows } = await Vote.findAndCountAll({
        where: {
          vote_voter: voter,
        },
        include: [
          {
            model: models.quests,
            as: 'quest',
            attributes: [
              'quest_key',
              'quest_title',
              'quest_status',
              'dao_draft_tx',
              'dao_success_tx',
              'dao_answer_tx',
              'quest_success_tx',
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
                required: false,
                attributes: ['answer_title', 'answer_key', 'answer_selected'],
              },
            ],
          },
        ],
        attributes: [
          'vote_id',
          'vote_voter',
          'vote_power',
          'vote_success_option',
          'vote_created_at',
          'vote_draft_option',
          'vote_success_option',
          'quest_answer_key',
          'vote_reward',
          'vote_created_at',
        ],
        limit,
        offset: (offset - 1) * limit,
        order: [['vote_created_at', 'DESC']],
      });
      const formattedVotes = rows.map((vote) => {
        let selected = null;
        let quest_answer_title = null;

        vote.quest.answers.forEach((answer) => {
          if (answer.answer_selected) {
            selected = {
              answer_title: answer.answer_title,
              answer_key: answer.answer_key,
            };
          }
          if (answer.answer_key == vote.quest_answer_key) {
            quest_answer_title = answer.answer_title;
          }
        });

        return {
          vote_id: vote.vote_id,
          vote_voter: vote.vote_voter,
          vote_power: vote.vote_power,
          vote_success_option: vote.vote_success_option,
          vote_created_at: vote.vote_created_at,
          vote_draft_option: vote.vote_draft_option,
          quest_answer_key: vote.quest_answer_key,
          vote_reward: vote.vote_reward,
          quest_key: vote.quest.quest_key,
          quest_title: vote.quest.quest_title,
          quest_status: vote.quest.quest_status,
          quest_category: vote.quest.quest_category ? vote.quest.quest_category.quest_category_title : null,
          dao_draft_tx: vote.quest.dao_draft_tx,
          dao_success_tx: vote.quest.dao_success_tx,
          dao_answer_tx: vote.quest.dao_answer_tx,
          quest_success_tx: vote.quest.quest_success_tx,
          quest_answer_title,
          selected,
        };
      });
      return {
        total: count,
        votes: formattedVotes,
      };
    } catch (e) {
      console.log(e);
    }
  },
};

module.exports = voteActions;
