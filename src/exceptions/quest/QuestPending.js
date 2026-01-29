const CustomErrorCase = require('../CustomErrorCase');

class QuestPending extends CustomErrorCase {
  constructor(message = 'Quest is Pending plz check') {
    super(400, message);
  }
}

module.exports = QuestPending;
