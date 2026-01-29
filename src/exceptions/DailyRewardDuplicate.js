const CustomErrorCase = require('./CustomErrorCase');

class DailyRewardDuplicate extends CustomErrorCase {
  constructor(message = 'Cannot get reward twice in a day') {
    super(400, message);
  }
}

module.exports = DailyRewardDuplicate;
