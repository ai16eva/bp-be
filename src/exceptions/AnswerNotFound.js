const CustomErrorCase = require('./CustomErrorCase');

class AnswerNotFound extends CustomErrorCase {
  constructor(message = 'Answer not found') {
    super(404, message);
  }
}

module.exports = AnswerNotFound;
