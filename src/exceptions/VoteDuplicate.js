const CustomErrorCase = require('./CustomErrorCase');

class VoteDuplicate extends CustomErrorCase {
  constructor(message = 'Vote already exists') {
    super(409, message);
  }
}

module.exports = VoteDuplicate;
