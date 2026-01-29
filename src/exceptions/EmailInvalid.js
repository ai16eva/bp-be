const CustomErrorCase = require('./CustomErrorCase');

class EmailInvalid extends CustomErrorCase {
  constructor(message = 'Invalid email address') {
    super(405, message);
  }
}

module.exports = EmailInvalid;
