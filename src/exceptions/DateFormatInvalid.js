const CustomErrorCase = require('./CustomErrorCase');

class DateFormatInvalid extends CustomErrorCase {
  constructor(message = 'Data format invalid') {
    super(400, message);
  }
}

module.exports = DateFormatInvalid;
