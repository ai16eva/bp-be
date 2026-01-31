const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const { sendErrorResponse } = require('../../utils/controllerHelpers');
const InvalidQuestStatus = require('../../exceptions/quest/InvalidQuestStatus');

const listController = {
  listQuestDao: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      const status = req.query.status;
      let result;

      switch (status) {
        case 'draft':
          result = await client.QuestList.draftListAtDaoPage(pageSize, page);
          break;
        case 'publish':
          result = await client.QuestList.publishList(pageSize, page);
          break;
        case 'decision':
          result = await client.QuestList.deicisionList(pageSize, page);
          break;
        case 'answer':
          result = await client.QuestList.answerListAtDaoPage(pageSize, page);
          break;
        case 'success':
          result = await client.QuestList.successList(pageSize, page);
          break;
        case 'adjourn':
          result = await client.QuestList.adjournList(pageSize, page);
          break;
        case 'pending':
          result = await client.QuestList.pendingList(pageSize, page);
          break;
        case 'ongoing':
          result = await client.QuestList.onGoingList(pageSize, page);
          break;
        default:
          throw new InvalidQuestStatus();
      }
      return res.status(200).json(success(result));
    } catch (error) {
      const errorCode = error.statusCode || 400;
      return sendErrorResponse(error, res, errorCode);
    }
  },
};

module.exports = listController;

