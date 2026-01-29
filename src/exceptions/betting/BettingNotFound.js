const CustomErrorCase = require("../CustomErrorCase");

class BettingNotFound extends CustomErrorCase {
    constructor() {
        super(404, "Quest Does not exist.");
    }
}

module.exports = BettingNotFound;