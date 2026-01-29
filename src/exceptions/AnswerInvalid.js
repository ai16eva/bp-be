const CustomErrorCase = require('./CustomErrorCase');

class AnswerInvalid extends CustomErrorCase {
  constructor(message = 'Answer Invalid') {
    super(400, message);
  }
}

module.exports = AnswerInvalid;
