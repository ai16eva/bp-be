const CustomErrorCase = require( "../CustomErrorCase");

class InvalidBettingToken extends CustomErrorCase {
    constructor(message = 'Invalid Betting Token') {
        super(401, message);
    }
}

module.exports = InvalidBettingToken;