const Member = require('./memberActions');
const QuestDao = require('./questDaoActions');
const Vote = require('./voteActions');
const Season = require('./seasonActions');
const QuestCategory = require('./questCategoryActions');
const Answer = require('./AnswerAction');
const Betting = require('./bettingActions');
const QuestList = require('./questListActions');
const DailyReward = require('./DailyRewardActions');
const Board = require('./boardActions');
const Referral = require('./ReferralActions');
const Checkin = require('./CheckinActions');
const ReferralCode = require('./ReferralCodeActions');
const ActivityRewardActions = require("./ActivityRewardActions");
module.exports = {
  Member,
  QuestDao,
  Vote,
  Season,
  QuestCategory,
  Answer,
  Betting,
  QuestList,
  DailyReward,
  Board,
  Referral,
  Checkin,
  ReferralCode,
  ActivityRewardActions,
};
