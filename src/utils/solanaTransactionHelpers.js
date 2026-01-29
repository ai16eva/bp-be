/**
 * Solana Transaction Utilities
 * Helper functions for transaction handling with retry logic and priority fees
 */

const { Transaction, ComputeBudgetProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { handleSolanaError } = require('./solanaErrorHandler');

/**
 * Add compute budget instructions to transaction
 * @param {Transaction} transaction - Solana transaction
 * @param {object} options - Options for compute budget
 * @param {number} options.computeUnitPrice - Priority fee in microLamports (default: 1000)
 * @param {number} options.computeUnitLimit - Max compute units (default: 200000)
 * @returns {Transaction} Transaction with compute budget instructions
 */
function addComputeBudget(transaction, options = {}) {
  const {
    computeUnitPrice = 1000, // 0.000001 SOL per transaction (1 microLamport = 1e-6 SOL)
    computeUnitLimit = 200000, // Default Solana compute unit limit
  } = options;

  // Add compute budget instructions at the beginning
  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computeUnitPrice }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
  ];

  // Insert at the beginning of transaction
  transaction.instructions = [...instructions, ...transaction.instructions];
  
  return transaction;
}

/**
 * Send transaction with retry logic
 * @param {Connection} connection - Solana connection
 * @param {Transaction} transaction - Transaction to send
 * @param {Array<Keypair>} signers - Transaction signers
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @param {boolean} options.updateBlockhash - Whether to update blockhash on retry (default: true)
 * @param {object} options.computeBudget - Compute budget options
 * @returns {Promise<object>} Transaction receipt
 */
async function sendWithRetry(
  connection,
  transaction,
  signers,
  options = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    updateBlockhash = true,
    computeBudget = null,
    commitment = 'confirmed',
  } = options;

  // Add compute budget if specified
  if (computeBudget) {
    addComputeBudget(transaction, computeBudget);
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Update blockhash if needed (especially for retries)
      if (updateBlockhash && (attempt > 1 || !transaction.recentBlockhash)) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        
        // Re-sign transaction with new blockhash
        if (signers.length > 0) {
          transaction.sign(...signers);
        }
      }

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
        {
          commitment,
          skipPreflight: false,
        }
      );

      return {
        success: true,
        signature,
        transactionHash: signature,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const errorInfo = handleSolanaError(error);
      const isRetryable = errorInfo.retryable || 
                         errorInfo.name === 'BlockhashExpired' ||
                         errorInfo.name === 'NetworkError' ||
                         error.message.includes('block height exceeded') ||
                         error.message.includes('Blockhash not found');

      // If not retryable or max retries reached, throw error
      if (!isRetryable || attempt >= maxRetries) {
        if (attempt < maxRetries && isRetryable) {
          // Wait before next retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
          continue;
        }
        
        // Last attempt failed or non-retryable error
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Transaction failed after all retries');
}

/**
 * Send transaction with automatic blockhash management
 * @param {Connection} connection - Solana connection
 * @param {Transaction} transaction - Transaction to send
 * @param {Array<Keypair>} signers - Transaction signers
 * @param {object} options - Send options
 * @returns {Promise<object>} Transaction receipt
 */
async function sendWithAutoBlockhash(
  connection,
  transaction,
  signers,
  options = {}
) {
  const {
    commitment = 'confirmed',
    computeBudget = null,
  } = options;

  // Ensure blockhash is fresh
  if (!transaction.recentBlockhash) {
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
  }

  // Add compute budget if specified
  if (computeBudget) {
    addComputeBudget(transaction, computeBudget);
  }

  // Re-sign if needed
  if (signers.length > 0 && transaction.signatures.length === 0) {
    transaction.sign(...signers);
  }

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        commitment,
        skipPreflight: false,
      }
    );

    return {
      success: true,
      signature,
      transactionHash: signature,
    };
  } catch (error) {
    const errorInfo = handleSolanaError(error);
    throw {
      ...errorInfo,
      originalError: error,
    };
  }
}

/**
 * Estimate transaction fee
 * @param {Connection} connection - Solana connection
 * @param {Transaction} transaction - Transaction to estimate
 * @returns {Promise<number>} Estimated fee in Lamports
 */
async function estimateTransactionFee(connection, transaction) {
  try {
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    return fee?.value || 5000; // Default Solana transaction fee (~0.000005 SOL)
  } catch (error) {
    console.warn('Failed to estimate transaction fee:', error.message);
    return 5000; // Return default fee on error
  }
}

/**
 * Check if transaction is confirmed
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @param {string} commitment - Commitment level (default: 'confirmed')
 * @returns {Promise<object>} Transaction status
 */
async function checkTransactionStatus(connection, signature, commitment = 'confirmed') {
  try {
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    
    return {
      signature,
      confirmed: status?.value?.confirmationStatus === commitment || 
                status?.value?.confirmationStatus === 'finalized',
      status: status?.value?.confirmationStatus || 'unknown',
      err: status?.value?.err || null,
      slot: status?.value?.slot || null,
    };
  } catch (error) {
    return {
      signature,
      confirmed: false,
      status: 'error',
      error: error.message,
    };
  }
}

module.exports = {
  addComputeBudget,
  sendWithRetry,
  sendWithAutoBlockhash,
  estimateTransactionFee,
  checkTransactionStatus,
};

