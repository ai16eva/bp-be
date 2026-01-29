const TxHashInvalid = require('../exceptions/TxHashInvalid');

function validateTransactionHash(txHash) {
  if (txHash === null || txHash === undefined) {
    throw new TxHashInvalid('TxHash cannot be null or undefined');
  }

  if (typeof txHash !== 'string' || txHash.trim() === '') {
    throw new TxHashInvalid('Transaction hash must be a non-empty string');
  }

  // Check if it's a valid Solana transaction signature (Base58, 64-88 characters)
  const solanaTxPattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
  if (solanaTxPattern.test(txHash)) {
    return txHash; // Valid Solana transaction signature
  }

  // Check if it's a valid EVM transaction hash (0x + 64 hex characters)
  const evmTxPattern = /^0x[a-fA-F0-9]{64}$/;
  if (evmTxPattern.test(txHash)) {
    return txHash; // Valid EVM transaction hash
  }

  throw new TxHashInvalid('Invalid transaction hash format: must be Solana signature or EVM hash');
}

module.exports = validateTransactionHash;
