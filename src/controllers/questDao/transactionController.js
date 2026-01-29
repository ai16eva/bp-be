const { err, success } = require('../../utils/responses');
const transactionStatusService = require('../../services/transactionStatusService');
const { sendErrorResponse } = require('../../utils/controllerHelpers');

const transactionController = {
  submitTransactionSignature: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { signature, type, updateData } = req.body;

      if (!signature || !type) {
        return res.status(400).json(err(new Error('signature and type are required')));
      }

      transactionStatusService.addPendingTransaction(signature, quest_key, type, updateData);

      return res.status(200).json(success({
        signature,
        questKey: quest_key,
        message: 'Transaction signature submitted for monitoring. Database will be updated when confirmed.'
      }, 'Transaction monitoring started'));
    } catch (e) {
      console.error('Submit transaction signature error:', e.message);
      return sendErrorResponse(e, res);
    }
  },

  getPendingTransactions: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const pending = transactionStatusService.getPendingForQuest(quest_key);

      return res.status(200).json(success({
        questKey: quest_key,
        pendingTransactions: pending,
        count: pending.length
      }, 'Pending transactions retrieved'));
    } catch (e) {
      console.error('Get pending transactions error:', e.message);
      return sendErrorResponse(e, res);
    }
  },
};

module.exports = transactionController;

