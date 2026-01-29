const CustomErrorCase = require('./CustomErrorCase');

class ContractInteractionError extends CustomErrorCase {
  constructor(message = 'Something went wrong in Smart Contract call..') {
    super(400, message);
  }
}

module.exports = ContractInteractionError;
