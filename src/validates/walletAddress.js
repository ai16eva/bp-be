const { PublicKey } = require('@solana/web3.js');
const WalletAddressInvalid = require('../exceptions/WalleltAddressInvalid');

/**
 * Check if address is a valid Solana address
 * @param {string} address 
 * @returns {boolean}
 */
function isValidSolanaAddress(address) {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey);
  } catch (error) {
    return false;
  }
}

/**
 * Check Given Wallet address is valid (Solana only)
 * @param {string} address - wallet address
 * @throws {WalletAddressInvalid} If Invalid wallet address
 * @returns {string} normalized wallet address
 */
function validateWalletAddress(address) {
  if (address === null || address === undefined) {
    throw new WalletAddressInvalid('Wallet address cannot be null or undefined');
  }

  if (typeof address !== 'string' || address.trim() === '') {
    throw new WalletAddressInvalid('Wallet address must be a non-empty string');
  }

  // Check if it's a valid Solana address
  if (isValidSolanaAddress(address)) {
    // Solana addresses are case-sensitive, return as is
    return address;
  }

  throw new WalletAddressInvalid('Invalid Solana wallet address format');
}

module.exports = validateWalletAddress;