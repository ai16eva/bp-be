const models = require('../models/mysql');
const MissingRequiredParameter = require('../exceptions/MissingRequiredParameter'); // Adjust the path as needed
const AnswerNotFound = require('../exceptions/AnswerNotFound');
const generateUniqueKey = require('../utils/uniquekey_generate');
const AnswerInvalid = require('../exceptions/AnswerInvalid');
const QuestPending = require("../exceptions/quest/QuestPending");
const Answer = models.answers;
const SeasonCategory = models.season_categories;
const answerActions = {
  CreateAnswer: async (answer, transaction) => {
    let {
        quest_key,
        answer_title
    } = answer
    let newAnswer = {
      answer_key: generateUniqueKey(),
      answer_title: answer_title,
      quest_key: quest_key,
    }
      if (!answer) throw new MissingRequiredParameter();
      let ans =  await Answer.create(newAnswer, {transaction: transaction});
      return ans
  },
  UpdateData: async (answer_key, updateInfo) => {
    await Answer.update(updateInfo, { where: { answer_key } });
  },
  OnPending: async (answer_key) => {
    const answer = await Answer.findOne({ where: { answer_key } });
    if (!answer) throw new AnswerNotFound();
    if (answer.answer_pending === true) throw new QuestPending();

    await answer.update({ answer_pending: true });
  },
  OffPending: async (answer_key) => {
    await Answer.update({ answer_pending: false }, { where: { answer_key } });
  },
  MustGet: async (answer_key) => {
    const answer = await Answer.findOne({ where: { answer_key } });
    if (!answer) throw new AnswerNotFound();
    return answer;
  },
  isSelected: async (answer_key) => {
    const answer = await Answer.findOne({ where: { answer_key } });
    if (!answer.answer_selected) throw new AnswerInvalid('Answer is not selected yet');
  },
};

module.exports = answerActions;
