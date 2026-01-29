const CustomErrorCase = require("./CustomErrorCase");

class MemberDuplicate extends CustomErrorCase {
  constructor(message = "Member already exists") {
    super(409, message);
  }
}

module.exports = MemberDuplicate;
