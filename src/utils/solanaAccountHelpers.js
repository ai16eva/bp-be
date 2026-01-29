/**
 * Solana Account Utilities
 * Helper functions for checking account balances and status
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { lamportsToSol, formatSol } = require('./solanaAmountHelpers');

/**
 * Check account balance and return detailed info
 * @param {Connection} connection - Solana connection
 * @param {PublicKey|string} publicKey - Account public key
 * @param {number} minBalanceLamports - Minimum required balance in Lamports (default: 0.005 SOL)
 * @returns {Promise<object>} Balance information
 */
async function checkAccountBalance(connection, publicKey, minBalanceLamports = 5_000_000) {
  try {
    const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    const balance = await connection.getBalance(pubkey, 'confirmed');
    
    return {
      publicKey: pubkey.toBase58(),
      balance: balance,
      balanceSOL: lamportsToSol(balance),
      balanceFormatted: formatSol(balance),
      sufficient: balance >= minBalanceLamports,
      minRequired: minBalanceLamports,
      minRequiredSOL: lamportsToSol(minBalanceLamports),
      deficit: balance < minBalanceLamports ? minBalanceLamports - balance : 0,
      deficitSOL: balance < minBalanceLamports ? lamportsToSol(minBalanceLamports - balance) : 0,
    };
  } catch (error) {
    return {
      publicKey: typeof publicKey === 'string' ? publicKey : publicKey.toBase58(),
      error: error.message,
      balance: 0,
      balanceSOL: 0,
      sufficient: false,
    };
  }
}

/**
 * Check multiple account balances
 * @param {Connection} connection - Solana connection
 * @param {Array<PublicKey|string>} publicKeys - Array of account public keys
 * @param {number} minBalanceLamports - Minimum required balance
 * @returns {Promise<Array<object>>} Array of balance information
 */
async function checkMultipleAccountBalances(connection, publicKeys, minBalanceLamports = 5_000_000) {
  try {
    const pubkeys = publicKeys.map(key => 
      typeof key === 'string' ? new PublicKey(key) : key
    );
    
    // Use getMultipleAccountsInfo and extract balances
    const accountsInfo = await connection.getMultipleAccountsInfo(pubkeys, 'confirmed');
    
    return accountsInfo.map((accountInfo, index) => {
      const pubkey = pubkeys[index];
      const balanceLamports = accountInfo ? accountInfo.lamports : 0;
      
      return {
        publicKey: pubkey.toBase58(),
        balance: balanceLamports,
        balanceSOL: lamportsToSol(balanceLamports),
        balanceFormatted: formatSol(balanceLamports),
        sufficient: balanceLamports >= minBalanceLamports,
        minRequired: minBalanceLamports,
        deficit: balanceLamports < minBalanceLamports ? minBalanceLamports - balanceLamports : 0,
      };
    });
  } catch (error) {
    throw new Error(`Failed to check account balances: ${error.message}`);
  }
}

/**
 * Get account info and check if it exists
 * @param {Connection} connection - Solana connection
 * @param {PublicKey|string} publicKey - Account public key
 * @returns {Promise<object>} Account info
 */
async function getAccountInfo(connection, publicKey) {
  try {
    const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    const accountInfo = await connection.getAccountInfo(pubkey, 'confirmed');
    
    if (!accountInfo) {
      return {
        exists: false,
        publicKey: pubkey.toBase58(),
      };
    }
    
    return {
      exists: true,
      publicKey: pubkey.toBase58(),
      lamports: accountInfo.lamports,
      owner: accountInfo.owner.toBase58(),
      executable: accountInfo.executable,
      rentEpoch: accountInfo.rentEpoch,
      dataLength: accountInfo.data.length,
      data: accountInfo.data,
    };
  } catch (error) {
    return {
      exists: false,
      publicKey: typeof publicKey === 'string' ? publicKey : publicKey.toBase58(),
      error: error.message,
    };
  }
}

/**
 * Check if account exists
 * @param {Connection} connection - Solana connection
 * @param {PublicKey|string} publicKey - Account public key
 * @returns {Promise<boolean>} True if account exists
 */
async function accountExists(connection, publicKey) {
  try {
    const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    const accountInfo = await connection.getAccountInfo(pubkey, 'confirmed');
    return accountInfo !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get transaction count (similar to nonce in EVM)
 * @param {Connection} connection - Solana connection
 * @param {PublicKey|string} publicKey - Account public key
 * @returns {Promise<number>} Transaction count
 */
async function getTransactionCount(connection, publicKey) {
  try {
    const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
    return signatures.length;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  checkAccountBalance,
  checkMultipleAccountBalances,
  getAccountInfo,
  accountExists,
  getTransactionCount,
};

