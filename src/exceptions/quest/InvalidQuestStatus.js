const CustomErrorCase = require('../CustomErrorCase');

class InvalidQuestStatus extends CustomErrorCase {
  constructor(message = 'Invalid Quest Status') {
    super(401, message);
  }
}

module.exports = InvalidQuestStatus;
