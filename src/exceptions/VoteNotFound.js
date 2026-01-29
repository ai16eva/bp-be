const CustomErrorCase = require('./CustomErrorCase');

class VoteNotFound extends CustomErrorCase {
  constructor(message = 'Vote Not Found') {
    super(404, message);
  }
}

module.exports = VoteNotFound;
