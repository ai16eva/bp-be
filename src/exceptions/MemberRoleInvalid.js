const CustomErrorCase = require('./CustomErrorCase');

class MemberRoleInvalid extends CustomErrorCase {
  constructor(message = 'Invalid Role') {
    super(400, message);
  }
}

module.exports = MemberRoleInvalid;
