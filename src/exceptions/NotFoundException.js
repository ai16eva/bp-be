const CustomErrorCase = require ("./CustomErrorCase");

class NotFoundException extends CustomErrorCase {
    constructor(model='') {
        super(404, `${model} not found`);
    }
}

module.exports = NotFoundException;