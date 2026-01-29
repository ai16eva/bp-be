const CustomErrorCase = require('./CustomErrorCase');

class SeasonInvalidDataField extends CustomErrorCase {
  constructor(message = 'Invalid Season data field') {
    super(400, message);
  }
}

module.exports = SeasonInvalidDataField;
