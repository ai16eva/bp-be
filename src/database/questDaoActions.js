const InvalidQuestStatus = require('../exceptions/quest/InvalidQuestStatus');
const QuestNotFound = require('../exceptions/quest/QuestNotFound');
const QuestPending = require('../exceptions/quest/QuestPending');
const models = require('../models/mysql'); // Adjust the path as needed
const Quest = models.quests;

const questDaoActions = {
  /**
   * If governance contract call success then update quest dao data
   * @param {integer} quest_key
   * @param {object} data
   */
  UpdateDraftTime: async (quest_key, data) => {
    const updateDTO = {
      dao_created_tx: data.tx,
      dao_draft_start_at: data.start_at,
      dao_draft_end_at: data.end_at,
    };

    await Quest.update(updateDTO, { where: { quest_key } });
  },

  UpdateDecisionTime: async (quest_key, updateDTO) => {
    await Quest.update(updateDTO, { where: { quest_key } });
  },

  UpdateAnswerTime: async (quest_key, data) => {
    const updateDTO = {
      dao_answer_start_at: data.start_at,
      dao_answer_end_at: data.end_at,
    };

    await Quest.update(updateDTO, { where: { quest_key } });
  },
  /**
   * After contract call setTotalReward() update reward data
   * @param {integer} quest_key
   * @param {decimal} reward
   */
  UpdateReward: async (quest_key, reward) => {
    await Quest.update({ dao_reward: reward }, { where: { quest_key } });
  },

  Archive: async (quest_key) => {
    const gov_item = await Quest.findOne({ where: { quest_key } });

    if (!gov_item) {
      throw new QuestNotFound();
    }

    await gov_item.update({ governance_item_archived_at: new Date() });
  },

  Unarchive: async (quest_key) => {
    const gov_item = await Quest.findOne({ where: { quest_key } });

    if (!gov_item) {
      throw new QuestNotFound();
    }

    await gov_item.update({ governance_item_archived_at: null });
  },

  /**
   * Update both level and quest status after governance contract or market contract call
   * @param {BigInt} quest_key
   * @param {object} updateInfo : quest_status required. The other is option
   */
  UpdateStatus: async (quest_key, updateInfo) => {
    if (updateInfo.quest_status === undefined) throw new InvalidQuestStatus('Quest status required');
    
    const [affectedRows] = await Quest.update(updateInfo, { where: { quest_key } });
    
    if (affectedRows === 0) {
      throw new QuestNotFound(`Quest ${quest_key} not found or update failed`);
    }
    
    // Verify the update was successful
    const verifyAttributes = ['quest_key', 'quest_status'];
    if (updateInfo.quest_pending !== undefined) {
      verifyAttributes.push('quest_pending');
    }
    
    const updatedQuest = await Quest.findOne({ 
      where: { quest_key },
      attributes: verifyAttributes
    });
    
    if (!updatedQuest) {
      throw new QuestNotFound(`Quest ${quest_key} not found after update`);
    }
    
    if (updatedQuest.quest_status !== updateInfo.quest_status) {
      throw new Error(`Failed to update quest status. Expected: ${updateInfo.quest_status}, Actual: ${updatedQuest.quest_status}`);
    }
    
    // Verify quest_pending if it was updated
    if (updateInfo.quest_pending !== undefined && updatedQuest.quest_pending !== updateInfo.quest_pending) {
      // Retry update quest_pending
      try {
        await Quest.update({ quest_pending: updateInfo.quest_pending }, { where: { quest_key } });
      } catch (retryErr) {
        console.error(`[QuestDao.UpdateStatus] Failed to retry quest_pending update for quest ${quest_key}:`, retryErr.message);
        throw new Error(`Failed to update quest_pending. Expected: ${updateInfo.quest_pending}, Actual: ${updatedQuest.quest_pending}`);
      }
    }
  },
  /**
   *
   * @param {bigint} quest_key
   * @param {object} updateInfo update any data you want
   */
  UpdateData: async (quest_key, updateInfo) => {
    await Quest.update(updateInfo, { where: { quest_key } });
  },

  OnPending: async (quest_key) => {
    const quest = await Quest.findOne({ where: { quest_key } });
    if (!quest) throw new QuestNotFound();
    if (quest.quest_pending === true) throw new QuestPending();

    await quest.update({ quest_pending: true });
  },

  UpdatePending: async (quest) => {
    await quest.update({ quest_pending: true });
  },

  OffPending: async (quest_key) => {
    await Quest.update({ quest_pending: false }, { where: { quest_key } });
  },

  getQuestWithSeason: async (quest_key) => {
    const quest = await Quest.findOne({
      where: { quest_key },
      attributes: ['quest_key', 'quest_status', 'quest_pending', 'quest_creator', 'quest_betting_token', 'quest_betting_token_address', 'quest_title'],
      include: [
        {
          model: models.answers,
          as: 'answers',
          attributes: ['answer_key'],
        },
        {
          model: models.seasons,
          as: 'season',
          attributes: ['service_fee', 'charity_fee', 'creator_fee'],
        },
      ],
    });

    if (!quest) {
      throw new QuestNotFound();
    }

    // Transform the result to include season data directly in the quest object
    const questData = quest.get({ plain: true });
    questData.answers = questData.answers.map((answer) => answer.answer_key);

    return questData;
  },

  getQuestWithAnswers: async (quest_key) => {
    const quest = await Quest.findOne({
      where: { quest_key },
      attributes: ['quest_key', 'quest_status', 'quest_pending', 'quest_creator', 'quest_betting_token', 'quest_betting_token_address', 'quest_title'],
      include: [
        {
          model: models.answers,
          as: 'answers',
          attributes: ['answer_key'],
        },
      ],
    });

    if (!quest) {
      throw new QuestNotFound();
    }

    // Transform the result to include season data directly in the quest object
    const questData = quest.get({ plain: true });
    questData.answers = questData.answers.map((answer) => answer.answer_key);

    return questData;
  },

  getQuestWithSeasonAndAnswers: async (quest_key) => {
    const quest = await Quest.findOne({
      where: { quest_key },
      attributes: ['quest_key', 'quest_status', 'quest_pending', 'quest_creator', 'quest_betting_token', 'quest_betting_token_address', 'quest_title'],
      include: [
        {
          model: models.answers,
          as: 'answers',
          attributes: ['answer_key'],
        },
        {
          model: models.seasons,
          as: 'season',
          attributes: ['service_fee', 'charity_fee', 'creator_fee'],
        },
      ],
    });

    if (!quest) {
      throw new QuestNotFound();
    }

    const questData = quest.get({ plain: true });

    return questData;
  },
};

module.exports = questDaoActions;
