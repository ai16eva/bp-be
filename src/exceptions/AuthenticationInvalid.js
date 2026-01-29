const CustomErrorCase = require('./CustomErrorCase');

class AuthenticationInvalid extends CustomErrorCase {
  constructor(message = 'Wrong authentication') {
    super(403, message);
  }
}

module.exports = AuthenticationInvalid;
