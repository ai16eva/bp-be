/**
 * Failed Transaction Queue
 * Handles backup and retry mechanism for failed transactions
 */

const models = require('../models/mysql');
const client = require('../database/client');

/**
 * Store failed transaction for retry
 * @param {object} transactionData - Transaction data to retry
 * @param {string} transactionData.type - Type of transaction (e.g., 'ACTIVITY_REWARD')
 * @param {string} transactionData.wallet_address - Wallet address
 * @param {object} transactionData.data - Transaction-specific data
 * @param {number} transactionData.retryCount - Current retry count (default: 0)
 * @returns {Promise<object>} Created failed transaction record
 */
async function storeFailedTransaction(transactionData) {
  try {
    // For now, log to console and optionally store in a simple file or DB table
    // In production, consider using Redis queue or proper job queue (Bull)
    const {
      type,
      wallet_address,
      data,
      retryCount = 0,
      error = null,
    } = transactionData;

    const failedTx = {
      type,
      wallet_address,
      data: JSON.stringify(data || {}),
      retry_count: retryCount,
      error_message: error?.message || null,
      created_at: new Date(),
      last_retry_at: null,
      status: 'pending',
    };

    // Log for now (can be extended to DB table or queue)
    console.warn('Failed transaction stored for retry:', {
      type,
      wallet_address,
      retryCount,
      error: error?.message,
    });

    // Option 1: Store in database table (if exists)
    // Uncomment when failed_transactions table is created
    /*
    try {
      const FailedTransaction = models.failed_transactions;
      if (FailedTransaction) {
        await FailedTransaction.create(failedTx);
      }
    } catch (dbError) {
      console.error('Failed to store in DB, logging only:', dbError.message);
    }
    */

    // Option 2: Store in Redis queue (if Redis available)
    // Can be implemented later when Redis is set up

    return failedTx;
  } catch (error) {
    console.error('Error storing failed transaction:', error.message);
    // Don't throw - logging is best effort
    return null;
  }
}

/**
 * Retry failed transaction
 * @param {object} failedTx - Failed transaction record
 * @param {function} retryFunction - Function to retry the transaction
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<boolean>} Success status
 */
async function retryFailedTransaction(failedTx, retryFunction, maxRetries = 3) {
  try {
    const currentRetryCount = failedTx.retry_count || 0;
    
    if (currentRetryCount >= maxRetries) {
      console.warn(`Max retries reached for transaction ${failedTx.type}:`, failedTx.wallet_address);
      return false;
    }

    // Exponential backoff delay
    const delayMs = Math.pow(2, currentRetryCount) * 1000; // 1s, 2s, 4s, etc.
    
    console.log(`Retrying transaction ${failedTx.type} for ${failedTx.wallet_address} (attempt ${currentRetryCount + 1}/${maxRetries})`);
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delayMs));

    // Execute retry function
    const result = await retryFunction(failedTx.data);

    if (result) {
      console.log(`  Successfully retried transaction ${failedTx.type} for ${failedTx.wallet_address}`);
      return true;
    } else {
      // Update retry count and store again
      await storeFailedTransaction({
        ...failedTx,
        retry_count: currentRetryCount + 1,
        last_retry_at: new Date(),
      });
      return false;
    }
  } catch (error) {
    console.error(`Error retrying transaction ${failedTx.type}:`, error.message);
    // Update retry count and store again
    await storeFailedTransaction({
      ...failedTx,
      retry_count: (failedTx.retry_count || 0) + 1,
      error: error,
      last_retry_at: new Date(),
    });
    return false;
  }
}

/**
 * Process pending failed transactions
 * This can be called by a cron job or background worker
 */
async function processPendingTransactions() {
  console.log('Processing pending failed transactions...');
  // Implementation depends on storage mechanism (DB, Redis, etc.)
  // For now, this is a placeholder
  // In production, query failed_transactions table or Redis queue
}

module.exports = {
  storeFailedTransaction,
  retryFailedTransaction,
  processPendingTransactions,
};

