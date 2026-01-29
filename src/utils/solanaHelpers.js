const { BN } = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

/**
 * Convert string or number to BN
 * @param {string|number|BN} value - Value to convert
 * @returns {BN} - BigNumber instance
 */
function convertToBN(value) {
  if (value instanceof BN) {
    return value;
  }
  
  if (typeof value === 'string') {
    // Handle hex strings
    if (value.startsWith('0x')) {
      return new BN(value.slice(2), 16);
    }
    // Handle decimal strings
    return new BN(value, 10);
  }
  
  if (typeof value === 'number') {
    return new BN(value);
  }
  
  throw new Error(`Cannot convert ${typeof value} to BN`);
}

/**
 * Convert string to PublicKey
 * @param {string|PublicKey} address - Solana address string
 * @returns {PublicKey} - PublicKey instance
 */
function convertToPublicKey(address) {
  if (address instanceof PublicKey) {
    return address;
  }

  if (typeof address === 'string') {
    return new PublicKey(address);
  }

  // Accept Buffer/Uint8Array
  if (address && (address instanceof Uint8Array || Buffer.isBuffer(address))) {
    return new PublicKey(address);
  }

  // Accept objects that can stringify to base58
  if (address && typeof address.toBase58 === 'function') {
    return new PublicKey(address.toBase58());
  }
  if (address && typeof address.toString === 'function') {
    const s = address.toString();
    // Heuristically detect base58 length for PublicKey
    if (s && s.length >= 32) {
      return new PublicKey(s);
    }
  }

  throw new Error(`Cannot convert ${typeof address} to PublicKey`);
}

module.exports = {
  convertToBN,
  convertToPublicKey
};
