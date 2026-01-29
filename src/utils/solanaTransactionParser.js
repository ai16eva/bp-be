/**
 * Solana Transaction Parser Utilities
 * Helper functions to extract block timestamps and parse events from Solana transactions
 */

const { Connection } = require('@solana/web3.js');

/**
 * Get block timestamp from transaction signature
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @param {string} commitment - Commitment level (default: 'confirmed')
 * @returns {Promise<Date|null>} Block timestamp as Date object, or null if not found
 */
async function getBlockTimestampFromTransaction(connection, signature, commitment = 'confirmed') {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.warn(`Transaction not found: ${signature}`);
      return null;
    }

    if (tx.slot !== undefined && tx.slot !== null) {
      const blockTime = await connection.getBlockTime(tx.slot);
      if (blockTime !== null) {
        return new Date(blockTime * 1000);
      }
    }

    if (tx.blockTime) {
      return new Date(tx.blockTime * 1000);
    }

    console.warn(`Block time not available for transaction: ${signature}`);
    return null;
  } catch (error) {
    console.error(`Failed to get block timestamp for transaction ${signature}:`, error.message);
    return null;
  }
}

/**
 * Get transaction slot from signature
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @param {string} commitment - Commitment level
 * @returns {Promise<number|null>} Slot number or null
 */
async function getTransactionSlot(connection, signature, commitment = 'confirmed') {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    });
    return tx?.slot || null;
  } catch (error) {
    console.error(`Failed to get slot for transaction ${signature}:`, error.message);
    return null;
  }
}

/**
 * Parse Anchor program events from transaction logs
 * @param {object} transaction - Solana transaction object (from getTransaction)
 * @param {PublicKey} programId - Anchor program ID
 * @returns {Array<object>} Parsed events array
 */
function parseAnchorEvents(transaction, programId) {
  try {
    if (!transaction || !transaction.meta || !transaction.meta.logMessages) {
      return [];
    }

    const events = [];
    const logMessages = transaction.meta.logMessages || [];
    
    // Parse Anchor events from log messages
    // Anchor events are typically in format: "Program log: <event_data>"
    for (const log of logMessages) {
      // Look for Anchor event patterns
      if (log.includes('Program data:') || log.includes('Program log:')) {
        // Try to extract event data
        // Format depends on Anchor version and event structure
        try {
          // Extract JSON-like data from log
          const jsonMatch = log.match(/{[^}]+}/);
          if (jsonMatch) {
            try {
              const eventData = JSON.parse(jsonMatch[0]);
              events.push(eventData);
            } catch (parseError) {
              // Not JSON, continue
            }
          }
        } catch (error) {
          // Continue parsing other logs
        }
      }
    }

    return events;
  } catch (error) {
    console.error('Error parsing Anchor events:', error.message);
    return [];
  }
}

/**
 * Extract decision result from transaction events
 * @param {object} transaction - Solana transaction object
 * @param {object} program - Anchor program instance
 * @returns {Promise<string|null>} Decision result ('success' or 'adjourn') or null
 */
async function extractDecisionResult(transaction, program) {
  try {
    if (!transaction || !transaction.meta || !transaction.meta.logMessages) {
      return null;
    }

    const logs = transaction.meta.logMessages;
    
    // Look for decision-related events in logs
    // Pattern depends on how Governance program emits events
    for (const log of logs) {
      // Check for success pattern
      if (log.includes('DecisionResult') || log.includes('SetDecision')) {
        if (log.includes('success') || log.includes('Success')) {
          return 'success';
        }
        if (log.includes('adjourn') || log.includes('Adjourn')) {
          return 'adjourn';
        }
      }
      
      // Check for vote counts that indicate result
      if (log.includes('countSuccess') || log.includes('count_success')) {
        const successMatch = log.match(/countSuccess[:\s]*(\d+)/i);
        const adjournMatch = log.match(/countAdjourn[:\s]*(\d+)/i);
        
        if (successMatch && adjournMatch) {
          const successCount = parseInt(successMatch[1]);
          const adjournCount = parseInt(adjournMatch[1]);
          
          if (adjournCount > successCount) {
            return 'adjourn';
          } else {
            return 'success';
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting decision result:', error.message);
    return null;
  }
}

/**
 * Extract answer end time from governance item (on-chain data)
 * Alternative to parsing events - fetch from account data
 * @param {object} governanceSDK - Governance SDK instance
 * @param {BN} questKeyBN - Quest key as BN
 * @returns {Promise<Date|null>} Answer end time or null
 */
async function getAnswerEndTimeFromAccount(governanceSDK, questKeyBN) {
  try {
    const governanceItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
    
    if (governanceItem && governanceItem.answerEndTime) {
      const endTime = governanceItem.answerEndTime;
      // Convert BN timestamp to Date
      if (endTime.toNumber) {
        const timestamp = endTime.toNumber();
        return new Date(timestamp * 1000);
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get answer end time from account:', error.message);
    return null;
  }
}

/**
 * Extract decision end time from governance item
 * @param {object} governanceSDK - Governance SDK instance
 * @param {BN} questKeyBN - Quest key as BN
 * @returns {Promise<Date|null>} Decision end time or null
 */
async function getDecisionEndTimeFromAccount(governanceSDK, questKeyBN) {
  try {
    const governanceItem = await governanceSDK.fetchGovernanceItem(questKeyBN);
    
    if (governanceItem && governanceItem.decisionEndTime) {
      const endTime = governanceItem.decisionEndTime;
      if (endTime.toNumber) {
        const timestamp = endTime.toNumber();
        return new Date(timestamp * 1000);
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get decision end time from account:', error.message);
    return null;
  }
}

/**
 * Comprehensive function to get transaction metadata including timestamp and events
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @param {object} options - Options
 * @param {object} options.governanceSDK - Governance SDK (optional, for account-based data)
 * @param {object} options.questKeyBN - Quest key as BN (optional)
 * @returns {Promise<object>} Transaction metadata
 */
async function getTransactionMetadata(connection, signature, options = {}) {
  const { governanceSDK, questKeyBN } = options;
  
  try {
    // Get transaction
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return {
        signature,
        exists: false,
        timestamp: null,
        slot: null,
      };
    }

    // Get block timestamp
    const timestamp = await getBlockTimestampFromTransaction(connection, signature);
    const slot = tx.slot;

    // Get end times from account if SDK and questKey provided
    let answerEndTime = null;
    let decisionEndTime = null;
    if (governanceSDK && questKeyBN) {
      try {
        answerEndTime = await getAnswerEndTimeFromAccount(governanceSDK, questKeyBN);
        decisionEndTime = await getDecisionEndTimeFromAccount(governanceSDK, questKeyBN);
      } catch (error) {
        // Account may not exist - this is expected for new quests
        // Silently continue without logging warning
        // console.warn('Failed to get end times from account:', error.message);
      }
    }

    // Extract decision result from logs if available
    let decisionResult = null;
    if (tx.meta && tx.meta.logMessages) {
      // Try to extract from logs
      decisionResult = await extractDecisionResult(tx, null);
    }

    return {
      signature,
      exists: true,
      timestamp,
      slot,
      blockTime: timestamp ? timestamp.getTime() / 1000 : null,
      answerEndTime,
      decisionEndTime,
      decisionResult,
      logs: tx.meta?.logMessages || [],
      success: tx.meta?.err === null,
    };
  } catch (error) {
    console.error(`Failed to get transaction metadata for ${signature}:`, error.message);
    return {
      signature,
      exists: false,
      error: error.message,
    };
  }
}

module.exports = {
  getBlockTimestampFromTransaction,
  getTransactionSlot,
  parseAnchorEvents,
  extractDecisionResult,
  getAnswerEndTimeFromAccount,
  getDecisionEndTimeFromAccount,
  getTransactionMetadata,
};

