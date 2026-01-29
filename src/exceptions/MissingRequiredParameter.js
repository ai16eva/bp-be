const CustomErrorCase = require("./CustomErrorCase");

class MissingRequiredParameter extends CustomErrorCase {
    constructor(msg) {
        super(401, msg ? msg :"Required parameter(s) missing.");
    }
}

module.exports = MissingRequiredParameter;