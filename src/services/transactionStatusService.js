const { Connection, PublicKey } = require('@solana/web3.js');
const client = require('../database/client');

class TransactionStatusService {
  constructor() {
    // Lazy initialization to avoid dotenv issues
    this.connection = null;
    this.pendingTransactions = new Map();
  }

  /**
   * Initialize connection if not already done
   */
  initializeConnection() {
    if (this.connection) return;
    
    // Load environment variables
    require('dotenv').config();
    
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
    console.log('Initializing TransactionStatusService with RPC:', rpcUrl);
    
    // Validate RPC URL
    if (!rpcUrl.startsWith('http')) {
      throw new Error(`Invalid RPC URL: ${rpcUrl}`);
    }
    
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Add transaction to monitoring queue
   * @param {string} signature - Transaction signature
   * @param {string} questKey - Quest key
   * @param {string} type - Transaction type (setQuestResult, makeQuestResult, etc.)
   * @param {object} updateData - Data to update in DB when confirmed
   */
  addPendingTransaction(signature, questKey, type, updateData = {}) {
    this.initializeConnection();
    
    this.pendingTransactions.set(signature, {
      questKey,
      type,
      updateData,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    // Start monitoring
    this.monitorTransaction(signature);
  }

  /**
   * Monitor transaction status with improved error handling
   * @param {string} signature - Transaction signature
   */
  async monitorTransaction(signature) {
    this.initializeConnection();
    
    const pendingTx = this.pendingTransactions.get(signature);
    if (!pendingTx) return;

    try {
      const { checkTransactionStatus } = require('../utils/solanaTransactionHelpers');
      const status = await checkTransactionStatus(this.connection, signature, 'confirmed');

      if (status.confirmed && status.status === 'finalized') {
        // Transaction confirmed
        await this.handleConfirmedTransaction(signature, pendingTx);
        this.pendingTransactions.delete(signature);
      } else if (status.err || status.status === 'error') {
        // Transaction failed
        await this.handleFailedTransaction(signature, pendingTx, status.err || status.error);
        this.pendingTransactions.delete(signature);
      } else {
        // Still pending, retry after delay
        pendingTx.retryCount++;
        const maxRetries = parseInt(process.env.SOLANA_MONITOR_MAX_RETRIES) || 10;
        const retryDelay = parseInt(process.env.SOLANA_MONITOR_RETRY_DELAY) || 5000;
        
        if (pendingTx.retryCount < maxRetries) {
          setTimeout(() => {
            this.monitorTransaction(signature);
          }, retryDelay);
        } else {
          // Timeout
          await this.handleTimeoutTransaction(signature, pendingTx);
          this.pendingTransactions.delete(signature);
        }
      }
    } catch (error) {
      console.error(`Error monitoring transaction ${signature}:`, error);
      // Retry on error with improved error handling
      pendingTx.retryCount++;
      const maxRetries = parseInt(process.env.SOLANA_MONITOR_MAX_RETRIES) || 10;
      const retryDelay = parseInt(process.env.SOLANA_MONITOR_RETRY_DELAY) || 5000;
      
      if (pendingTx.retryCount < maxRetries) {
        setTimeout(() => {
          this.monitorTransaction(signature);
        }, retryDelay);
      } else {
        console.error(` Transaction ${signature} monitoring failed after ${maxRetries} retries`);
        this.pendingTransactions.delete(signature);
      }
    }
  }

  async handleConfirmedTransaction(signature, pendingTx) {
    try {
      const { questKey, type, updateData } = pendingTx;
      
      let dbUpdate = {
        quest_pending: false,
        ...updateData
      };

      switch (type) {
        case 'publishMarket':
          dbUpdate.quest_publish_tx = signature;
          dbUpdate.quest_status = 'PUBLISH';
          dbUpdate.quest_publish_datetime = new Date();
          break;
        case 'adjournMarket':
          dbUpdate.quest_adjourn_tx = signature;
          dbUpdate.quest_status = 'ADJOURN';
          dbUpdate.quest_adjourn_datetime = new Date();
          break;
        case 'successMarket':
          dbUpdate.quest_success_tx = signature;
          dbUpdate.quest_status = 'MARKET_SUCCESS';
          dbUpdate.quest_success_datetime = new Date();
          break;
        case 'retrieveTokens':
          dbUpdate.quest_retrieve_tx = signature;
          break;
        case 'setQuestResult':
          dbUpdate.dao_draft_tx = signature;
          break;
        case 'makeQuestResult':
          dbUpdate.dao_draft_tx = signature;
          break;
        case 'startDecision':
          dbUpdate.dao_success_tx = signature;
          break;
        case 'setDecision':
          dbUpdate.dao_answer_tx = signature;
          break;
        case 'makeDecision':
          dbUpdate.dao_answer_tx = signature;
          break;
        case 'setAnswer':
          dbUpdate.answer_tx = signature;
          break;
        default:
          if (type.startsWith('dao_')) {
            dbUpdate[`${type}_tx`] = signature;
          }
      }

      // Use UpdateStatus if quest_status is provided, otherwise use UpdateData
      if (dbUpdate.quest_status !== undefined) {
      await client.QuestDao.UpdateStatus(questKey, dbUpdate);
      } else {
        await client.QuestDao.UpdateData(questKey, dbUpdate);
      }
      
      console.log(`  Transaction ${signature} confirmed for quest ${questKey} (${type})`);
    } catch (error) {
      console.error(`Error updating DB for confirmed transaction ${signature}:`, error);
    }
  }

  async handleFailedTransaction(signature, pendingTx, error) {
    try {
      const { questKey } = pendingTx;
      
      await client.QuestDao.UpdateData(questKey, { 
        quest_pending: false 
      });
      
      console.error(` Transaction ${signature} failed for quest ${questKey}:`, error);
    } catch (dbError) {
      console.error(`Error updating DB for failed transaction ${signature}:`, dbError);
    }
  }

  async handleTimeoutTransaction(signature, pendingTx) {
    try {
      const { questKey } = pendingTx;
      
      await client.QuestDao.UpdateData(questKey, { 
        quest_pending: false 
      });
      
      console.warn(`⏰ Transaction ${signature} timed out for quest ${questKey}`);
    } catch (error) {
      console.error(`Error updating DB for timeout transaction ${signature}:`, error);
    }
  }

  getPendingCount() {
    return this.pendingTransactions.size;
  }

  getPendingForQuest(questKey) {
    const pending = [];
    for (const [signature, tx] of this.pendingTransactions) {
      if (tx.questKey === questKey) {
        pending.push({ signature, ...tx });
      }
    }
    return pending;
  }
}

module.exports = new TransactionStatusService();
