const CustomErrorCase = require("../CustomErrorCase");

class QuestNotFound extends CustomErrorCase {
    constructor() {
        super(404, "Quest Does not exist.");
    }
}

module.exports = QuestNotFound;