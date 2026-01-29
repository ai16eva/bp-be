const CustomErrorCase = require('./CustomErrorCase');

class SeasonNotFound extends CustomErrorCase {
  constructor(message = 'Season not found') {
    super(404, message);
  }
}

module.exports = SeasonNotFound;
