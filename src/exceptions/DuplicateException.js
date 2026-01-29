const CustomErrorCase = require("./CustomErrorCase");

class DuplicateException extends CustomErrorCase {
    constructor(model='') {
        super(409, `${model} already exists`);
    }
}

module.exports = DuplicateException;