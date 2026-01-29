const baseController = require('./baseController');
const answerController = require('./answerController');
const decisionController = require('./decisionController');
const draftController = require('./draftController');
const marketController = require('./marketController');
const governanceController = require('./governanceController');
const syncController = require('./syncController');
const listController = require('./listController');
const transactionController = require('./transactionController');

const questDaoController = {
  BaseQuestDaoController: baseController,
  
  startDraft: draftController.startDraft,
  setDraftResult: draftController.setDraftResult,
  makeDraftResult: draftController.makeDraftResult,
  EndDraftTime: draftController.EndDraftTime,
  
  createGovernanceItem: governanceController.createGovernanceItem,
  
  finishQuest: marketController.finishQuest,
  publishQuest: marketController.publishQuest,
  adjournQuest: marketController.adjournQuest,
  successQuest: marketController.successQuest,
  retrieveToken: marketController.retrieveToken,
  setCancel: marketController.setCancel,
  
  startDaoSuccess: decisionController.startDaoSuccess,
  setDaoSuccess: decisionController.setDaoSuccess,
  makeDaoSuccess: decisionController.makeDaoSuccess,
  EndSuccessTime: decisionController.EndSuccessTime,
  
  setAnswer: answerController.setAnswer,
  finalizeAnswer: answerController.finalizeAnswer,
  EndAnswerTime: answerController.EndAnswerTime,
  
  syncStatus: syncController.syncStatus,
  
  listQuestDao: listController.listQuestDao,
  
  submitTransactionSignature: transactionController.submitTransactionSignature,
  getPendingTransactions: transactionController.getPendingTransactions,
};

module.exports = questDaoController;
module.exports.answerController = answerController;
module.exports.decisionController = decisionController;
module.exports.draftController = draftController;
module.exports.marketController = marketController;
module.exports.governanceController = governanceController;
module.exports.syncController = syncController;
module.exports.listController = listController;
module.exports.transactionController = transactionController;
module.exports.baseController = baseController;

