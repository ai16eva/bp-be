const CustomErrorCase = require('./CustomErrorCase');

class WalletTypeInvalid extends CustomErrorCase {
    constructor(message = 'Invalid wallet type') {
        super(400, message);
    }
}

module.exports = WalletTypeInvalid;