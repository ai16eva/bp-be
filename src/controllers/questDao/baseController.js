const client = require('../../database/client');
const models = require('../../models/mysql');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const solanaTxService = require('../../services/solanaTxService');
const QuestNotFound = require('../../exceptions/quest/QuestNotFound');
const InvalidQuestStatus = require('../../exceptions/quest/InvalidQuestStatus');

class BaseQuestDaoController {
  static async getQuestWithValidation(quest_key, requiredStatus = null) {
    const quest = await client.QuestDao.getQuestWithSeason(quest_key);
    if (!quest) throw new QuestNotFound();

    if (requiredStatus && quest.quest_status !== requiredStatus) {
      throw new InvalidQuestStatus(`Quest must be in ${requiredStatus} status`);
    }

    return quest;
  }

  static async getQuestWithAnswers(quest_key) {
    const quest = await client.QuestDao.getQuestWithSeasonAndAnswers
      ? await client.QuestDao.getQuestWithSeasonAndAnswers(quest_key)
      : await client.QuestDao.getQuestWithAnswers(quest_key);
    if (!quest) throw new QuestNotFound();
    return quest;
  }

  static async getSortedAnswerKeysByVotePower(quest_key, quest = null) {
    let sortedAnswers = [];
    let answerKeys = [];
    let highestVoteAnswerKey = null;

    try {
      sortedAnswers = await client.Vote.getHighestVotepowerAnswers(quest_key);
      answerKeys = sortedAnswers.map(a => Number(a.quest_answer_key)).filter(n => Number.isFinite(n) && n > 0);

      if (answerKeys.length > 0) {
        highestVoteAnswerKey = answerKeys[0];
      }
    } catch (e) {
      console.warn('getHighestVotepowerAnswers failed, using fallback:', e.message);

      if (!quest) {
        quest = await this.getQuestWithAnswers(quest_key);
      }

      answerKeys = Array.isArray(quest.answers)
        ? quest.answers.map(a => Number(a?.answer_key)).filter(n => Number.isFinite(n) && n > 0)
        : [];

      if (!answerKeys.length) {
        const answers = await models.answers.findAll({ where: { quest_key } });
        answerKeys = answers.map(a => Number(a.answer_key)).filter(n => Number.isFinite(n) && n > 0);
      }
    }

    return {
      answerKeys,
      highestVoteAnswerKey,
      sortedAnswers
    };
  }

  static async checkAnswerAlreadySet(quest_key) {
    try {
      const answerKey = await solanaTxService.getSelectedAnswerKey(quest_key);
      const answerKeyStr = typeof answerKey === 'object' && answerKey?.toString ? answerKey.toString() : String(answerKey);
      const isZero = answerKey.isZero ? answerKey.isZero() : (answerKeyStr === '0' || answerKeyStr === '');
      return !isZero;
    } catch (e) {
      try {
        const governanceSDK = getGovernanceSDK();
        const questKeyBN = convertToBN(quest_key);
        const gi = await governanceSDK.fetchGovernanceItem(questKeyBN);
        if (gi && gi.answerResult) {
          const ar = gi.answerResult;
          const arStr = ar?.toString?.() || '0';
          const arZero = ar?.isZero ? ar.isZero() : (arStr === '0');
          return !arZero;
        }
      } catch (_) { }
      return false;
    }
  }

  static async getSelectedAnswerKeyFromChain(quest_key) {
    try {
      const answerKey = await solanaTxService.getSelectedAnswerKey(quest_key);
      const answerKeyStr = typeof answerKey === 'object' && answerKey?.toString ? answerKey.toString() : String(answerKey);
      const isZero = answerKey.isZero ? answerKey.isZero() : (answerKeyStr === '0' || answerKeyStr === '');
      if (!isZero) {
        return answerKeyStr;
      }
    } catch (e) {
      try {
        const governanceSDK = getGovernanceSDK();
        const questKeyBN = convertToBN(quest_key);
        const gi = await governanceSDK.fetchGovernanceItem(questKeyBN);
        if (gi && gi.answerResult) {
          const ar = gi.answerResult;
          const arStr = ar?.toString?.() || '0';
          const arZero = ar?.isZero ? ar.isZero() : (arStr === '0');
          if (!arZero) {
            return arStr;
          }
        }
      } catch (_) { }
    }
    return null;
  }

  static async updateSelectedAnswerInDB(quest_key, selectedAnswerKey) {
    if (!selectedAnswerKey) return;

    await models.answers.update(
      { answer_selected: false },
      { where: { quest_key } }
    );
    await models.answers.update(
      { answer_selected: true },
      { where: { answer_key: selectedAnswerKey } }
    );
  }
}

module.exports = BaseQuestDaoController;

