const CustomErrorCase = require("./CustomErrorCase");

class MemberNotFound extends CustomErrorCase {
  constructor(message = "Member not found") {
    super(404, message);
  }
}

module.exports = MemberNotFound;
