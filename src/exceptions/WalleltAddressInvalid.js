const CustomErrorCase = require('./CustomErrorCase');

class WalletAddressInvalid extends CustomErrorCase {
  constructor(message = 'Invalid wallet address') {
    super(405, message);
  }
}

module.exports = WalletAddressInvalid;
