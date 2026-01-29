/**
 * Solana Amount Conversion Utilities
 * Helper functions for converting between SOL, Lamports, and token amounts
 */

const { BN } = require('@coral-xyz/anchor');

const SOL_TO_LAMPORTS = 1e9; // 1 SOL = 1,000,000,000 Lamports
const DEFAULT_DECIMALS = 9;

/**
 * Convert SOL to Lamports
 * @param {number|string} sol - Amount in SOL
 * @returns {BN} Amount in Lamports as BN
 */
function solToLamports(sol) {
  const solAmount = typeof sol === 'string' ? parseFloat(sol) : sol;
  if (isNaN(solAmount) || solAmount < 0) {
    throw new Error(`Invalid SOL amount: ${sol}`);
  }
  return new BN(Math.floor(solAmount * SOL_TO_LAMPORTS));
}

/**
 * Convert Lamports to SOL
 * @param {BN|number|string} lamports - Amount in Lamports
 * @returns {number} Amount in SOL
 */
function lamportsToSol(lamports) {
  let lamportsAmount;
  if (lamports instanceof BN) {
    lamportsAmount = lamports.toNumber();
  } else if (typeof lamports === 'string') {
    lamportsAmount = parseInt(lamports, 10);
  } else {
    lamportsAmount = lamports;
  }
  
  if (isNaN(lamportsAmount) || lamportsAmount < 0) {
    throw new Error(`Invalid Lamports amount: ${lamports}`);
  }
  
  return lamportsAmount / SOL_TO_LAMPORTS;
}

/**
 * Convert token amount to BN (with decimals)
 * @param {number|string} amount - Token amount
 * @param {number} decimals - Token decimals (default: 9)
 * @returns {BN} Amount as BN with decimals applied
 */
function tokenAmountToBN(amount, decimals = DEFAULT_DECIMALS) {
  const tokenAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(tokenAmount) || tokenAmount < 0) {
    throw new Error(`Invalid token amount: ${amount}`);
  }
  
  const multiplier = Math.pow(10, decimals);
  return new BN(Math.floor(tokenAmount * multiplier));
}

/**
 * Convert BN token amount to readable number
 * @param {BN|number|string} amountBN - Token amount as BN
 * @param {number} decimals - Token decimals (default: 9)
 * @returns {number} Token amount as number
 */
function bnToTokenAmount(amountBN, decimals = DEFAULT_DECIMALS) {
  let amount;
  if (amountBN instanceof BN) {
    amount = amountBN.toNumber();
  } else if (typeof amountBN === 'string') {
    amount = parseInt(amountBN, 10);
  } else {
    amount = amountBN;
  }
  
  if (isNaN(amount) || amount < 0) {
    throw new Error(`Invalid BN amount: ${amountBN}`);
  }
  
  const divisor = Math.pow(10, decimals);
  return amount / divisor;
}

/**
 * Format SOL amount for display
 * @param {BN|number|string} lamports - Amount in Lamports
 * @param {number} decimals - Number of decimal places (default: 4)
 * @returns {string} Formatted SOL string
 */
function formatSol(lamports, decimals = 4) {
  const sol = lamportsToSol(lamports);
  return sol.toFixed(decimals) + ' SOL';
}

/**
 * Format token amount for display
 * @param {BN|number|string} amountBN - Token amount as BN
 * @param {number} tokenDecimals - Token decimals (default: 9)
 * @param {number} displayDecimals - Display decimals (default: 4)
 * @returns {string} Formatted token string
 */
function formatToken(amountBN, tokenDecimals = DEFAULT_DECIMALS, displayDecimals = 4) {
  const amount = bnToTokenAmount(amountBN, tokenDecimals);
  return amount.toFixed(displayDecimals);
}

/**
 * Check if amount is sufficient
 * @param {BN|number|string} balance - Current balance
 * @param {BN|number|string} required - Required amount
 * @returns {boolean} True if balance >= required
 */
function isSufficientBalance(balance, required) {
  const balanceBN = balance instanceof BN ? balance : new BN(balance);
  const requiredBN = required instanceof BN ? required : new BN(required);
  return balanceBN.gte(requiredBN);
}

/**
 * Calculate minimum balance for rent exemption
 * @param {number} dataLength - Size of account data in bytes
 * @returns {BN} Minimum balance in Lamports
 */
function calculateRentExemptMin(dataLength) {
  // Solana rent exempt minimum calculation
  // Base rent = 0.00089 SOL per year per account
  // Approximate: ~2.03928 lamports per byte per year
  // Minimum: ~0.001 SOL (1,000,000 lamports) or account size * 8,888 lamports
  const bytesPerAccount = 128; // Minimum account size
  const lamportsPerBytePerYear = 3480; // Approximate
  const minBalance = Math.max(
    1_000_000, // 0.001 SOL minimum
    Math.ceil((dataLength + bytesPerAccount) * lamportsPerBytePerYear / 365 / 2) // Half year buffer
  );
  return new BN(minBalance);
}

module.exports = {
  solToLamports,
  lamportsToSol,
  tokenAmountToBN,
  bnToTokenAmount,
  formatSol,
  formatToken,
  isSufficientBalance,
  calculateRentExemptMin,
  SOL_TO_LAMPORTS,
  DEFAULT_DECIMALS,
};

