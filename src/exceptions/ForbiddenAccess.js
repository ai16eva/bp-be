const CustomErrorCase = require('./CustomErrorCase');

class ForbiddenAccess extends CustomErrorCase {
  constructor(message = 'Access Forbidden') {
    super(400, message);
  }
}

module.exports = ForbiddenAccess;
