const CustomErrorCase = require('./CustomErrorCase');

class TxHashInvalid extends CustomErrorCase {
  constructor(message = 'Transaction Hash Invalid') {
    super(405, message);
  }
}

module.exports = TxHashInvalid;
