/**
 * Controller Helper Utilities
 * Reusable functions for controllers to reduce code duplication
 */

const { getGovernanceSDK } = require('../config/solana');
const { checkAccountBalance } = require('./solanaAccountHelpers');
const { formatSol } = require('./solanaAmountHelpers');
const { handleSolanaError } = require('./solanaErrorHandler');
const ContractInteractionError = require('../exceptions/ContractInteractionError');
const solanaTxService = require('../services/solanaTxService');

/**
 * Ensure admin wallet has sufficient balance before transaction
 * @param {number} minBalanceLamports - Minimum balance in Lamports (default: 0.002 SOL)
 * @returns {Promise<void>} Throws error if insufficient balance
 */
async function ensureAdminBalance(minBalanceLamports = 2_000_000) {
  const adminKeypair = solanaTxService.getAdminKeypair();
  const governanceSDK = getGovernanceSDK();
  const balanceInfo = await checkAccountBalance(governanceSDK.connection, adminKeypair.publicKey, minBalanceLamports);
  
  if (!balanceInfo.sufficient) {
    throw new ContractInteractionError(
      `Admin wallet insufficient balance: ${balanceInfo.balanceFormatted}, need ${formatSol(minBalanceLamports)}`
    );
  }
}

/**
 * Handle controller errors with improved error handling
 * @param {Error} error - The error object
 * @param {object} res - Express response object
 * @param {object} options - Additional options
 * @param {string} options.questKey - Quest key for DB update
 * @param {function} options.onTimeout - Callback on timeout
 * @param {number} options.defaultStatus - Default status code (default: 400)
 * @returns {Promise<object>} Response object
 */
async function handleControllerError(error, res, options = {}) {
  const {
    questKey,
    onTimeout,
    defaultStatus = 400,
    clearPending = true,
  } = options;
  
  const errorInfo = handleSolanaError(error);
  const errorMessage = errorInfo.message || errorInfo.originalError?.message || error.message;
  
  // Handle transaction timeout or blockhash expired
  if (error.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
    if (onTimeout && questKey) {
      try {
        await onTimeout(error, errorInfo, questKey);
      } catch (dbError) {
        console.warn(`Failed to update DB after transaction timeout:`, questKey);
      }
    }
    return res.status(202).json(require('../utils/responses').success('', 'Pending'));
  }
  
  // Clear pending status if needed
  if (clearPending && questKey) {
    try {
      const client = require('../database/client');
      await client.QuestDao.UpdateData(questKey, { quest_pending: false });
    } catch (dbError) {
      console.warn(`Failed to clear pending status for quest:`, questKey);
    }
  }
  
  // Return error response
  return res.status(defaultStatus).json(
    require('../utils/responses').err(
      errorMessage.includes('ContractInteractionError') 
        ? new ContractInteractionError(errorMessage)
        : errorMessage
    )
  );
}

/**
 * Execute transaction with balance check and error handling
 * @param {function} transactionFn - Async function that executes the transaction
 * @param {object} res - Express response object
 * @param {object} options - Options
 * @param {string} options.questKey - Quest key for error handling
 * @param {number} options.minBalance - Minimum balance in Lamports
 * @param {function} options.onTimeout - Callback on timeout
 * @returns {Promise<object>} Transaction receipt or response
 */
async function executeWithBalanceCheck(transactionFn, res, options = {}) {
  const {
    questKey,
    minBalance = 2_000_000,
    onTimeout,
  } = options;
  
  try {
    // Check balance before transaction
    await ensureAdminBalance(minBalance);
    
    // Execute transaction
    return await transactionFn();
  } catch (error) {
    return handleControllerError(error, res, {
      questKey,
      onTimeout,
      clearPending: true,
    });
  }
}

/**
 * Standard error response helper
 * @param {Error} error - The error object
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @returns {object} Response object
 */
function sendErrorResponse(error, res, statusCode = 400) {
  const errorInfo = handleSolanaError(error);
  const errorMessage = errorInfo.message || error.message;
  return res.status(statusCode).json(require('../utils/responses').err(errorMessage));
}

/**
 * Standard success response helper
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {object} Response object
 */
function sendSuccessResponse(res, data = '', message = '', statusCode = 200) {
  return res.status(statusCode).json(require('../utils/responses').success(data, message));
}

module.exports = {
  ensureAdminBalance,
  handleControllerError,
  executeWithBalanceCheck,
  sendErrorResponse,
  sendSuccessResponse,
};

