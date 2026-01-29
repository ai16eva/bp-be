const CustomErrorCase = require('./CustomErrorCase');

class OptionInvalid extends CustomErrorCase {
  constructor(message = 'Option is invalid') {
    super(405, message);
  }
}

module.exports = OptionInvalid;
