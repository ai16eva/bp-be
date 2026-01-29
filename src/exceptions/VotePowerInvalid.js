const CustomErrorCase = require('./CustomErrorCase');

class VotePowerInvalid extends CustomErrorCase {
  constructor(message = 'Invalid voting power') {
    super(405, message);
  }
}

module.exports = VotePowerInvalid;
