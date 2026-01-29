const CustomErrorCase = require('./CustomErrorCase');

class QuestCategoryInvalid extends CustomErrorCase {
  constructor(message = 'Invalid quest category') {
    super(405, message);
  }
}

module.exports = QuestCategoryInvalid;
