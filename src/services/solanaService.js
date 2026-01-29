const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const BN = require('bn.js');
const solanaConfig = require('../config/solana');

class SolanaService {
  constructor() {
    this.connection = null;
    this.bpMarketSDK = null;
    this.initialize();
  }

  async initialize() {
    try {
      const cfg = solanaConfig.getSolanaConfig();
      if (!cfg || !cfg.rpcUrl) {
        const env = process.env.NODE_ENV || 'dev';
        throw new Error(`Solana RPC not configured for environment: ${env}`);
      }

      this.connection = new Connection(cfg.rpcUrl, 'confirmed');

      this.bpMarketSDK = solanaConfig.getBPMarketSDK();

      console.log('Solana service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Solana service:', error);
      throw error;
    }
  }

  /**
   * Create transaction to place bet
   * @param {string} marketKey - Market key (quest_key)
   * @param {string} answerKey - Answer key
   * @param {string} amount - Number of tokens to bet
   * @param {string} voterAddress - Voter wallet address
   * @returns {Object} Transaction object
   */
  async createBetTransaction(marketKey, answerKey, amount, voterAddress) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);
      const amountBN = new BN(amount);
      const voterPubkey = new PublicKey(voterAddress);

      const transaction = await this.bpMarketSDK.bet(
        marketKeyBN,
        answerKeyBN,
        amountBN,
        voterPubkey
      );

      return {
        success: true,
        transaction: transaction,
        marketKey: marketKey,
        answerKey: answerKey,
        amount: amount,
        voter: voterAddress,
      };
    } catch (error) {
      console.error('Error creating bet transaction:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create transaction to receive reward tokens
   * @param {string} marketKey - Market key (quest_key)
   * @param {string} answerKey - Answer key
   * @param {string} voterAddress - Voter wallet address
   * @returns {Object} Transaction object
   */
  async createReceiveTokenTransaction(marketKey, answerKey, voterAddress) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);
      const voterPubkey = new PublicKey(voterAddress);

      const transaction = await this.bpMarketSDK.receiveToken(
        marketKeyBN,
        answerKeyBN,
        voterPubkey
      );

      return {
        success: true,
        transaction: transaction,
        marketKey: marketKey,
        answerKey: answerKey,
        voter: voterAddress,
      };
    } catch (error) {
      console.error('Error creating receive token transaction:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check available tokens that can be received
   * @param {string} marketKey - Market key (quest_key)
   * @param {string} answerKey - Answer key
   * @param {string} voterAddress - Voter wallet address
   * @returns {Object} Available tokens info
   */
  async getAvailableReceiveTokens(marketKey, answerKey, voterAddress) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);
      const voterPubkey = new PublicKey(voterAddress);

      const availableTokens =
        await this.bpMarketSDK.availableReceiveTokensByUser(
          voterPubkey,
          marketKeyBN,
          answerKeyBN
        );

      return {
        success: true,
        availableTokens: availableTokens.toString(),
        marketKey: marketKey,
        answerKey: answerKey,
        voter: voterAddress,
      };
    } catch (error) {
      console.error('Error getting available receive tokens:', error);
      return {
        success: false,
        error: error.message,
        availableTokens: '0',
      };
    }
  }

  /**
   * Lấy thông tin market
   * @param {string} marketKey - Market key (quest_key)
   * @returns {Object} Market info
   */
  async getMarketInfo(marketKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const marketInfo = await this.bpMarketSDK.getMarketInfo(marketKeyBN);

      return {
        success: true,
        marketInfo: {
          creator: marketInfo.creator.toString(),
          title: marketInfo.title,
          status: marketInfo.status,
          totalTokens: marketInfo.totalTokens.toString(),
          remainTokens: marketInfo.remainTokens.toString(),
          rewardBaseTokens: marketInfo.rewardBaseTokens.toString(),
          correctAnswerKey: marketInfo.correctAnswerKey
            ? marketInfo.correctAnswerKey.toString()
            : null,
          approveTime: marketInfo.approveTime.toString(),
          successTime: marketInfo.successTime.toString(),
          adjournTime: marketInfo.adjournTime.toString(),
        },
      };
    } catch (error) {
      console.error('Error getting market info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user betting information
   * @param {string} marketKey - Market key (quest_key)
   * @param {string} answerKey - Answer key
   * @param {string} voterAddress - Voter wallet address
   * @returns {Object} Betting info
   */
  async getUserBetInfo(marketKey, answerKey, voterAddress) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);
      const voterPubkey = new PublicKey(voterAddress);

      const betInfo = await this.bpMarketSDK.getUserBetInfo(
        voterPubkey,
        marketKeyBN,
        answerKeyBN
      );

      return {
        success: true,
        betInfo: {
          exists: betInfo.exists,
          tokens: betInfo.tokens.toString(),
          createTime: betInfo.createTime.toString(),
          potentialWinnings: betInfo.potentialWinnings
            ? betInfo.potentialWinnings.toString()
            : null,
        },
      };
    } catch (error) {
      console.error('Error getting user bet info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user is locked
   * @param {string} voterAddress - Voter wallet address
   * @returns {Object} Lock status
   */
  async isUserLocked(voterAddress) {
    try {
      const voterPubkey = new PublicKey(voterAddress);
      const isLocked = await this.bpMarketSDK.isUserLocked(voterPubkey);

      return {
        success: true,
        isLocked: isLocked,
      };
    } catch (error) {
      console.error('Error checking user lock status:', error);
      return {
        success: false,
        error: error.message,
        isLocked: false,
      };
    }
  }

  /**
   * Lock a user on Solana
   * @param {string} userAddress - User wallet address to lock
   * @param {string} ownerAddress - Owner wallet address (with lock permission)
   * @returns {Object} Transaction object
   */
  async lockUser(userAddress, ownerAddress) {
    try {
      const userPubkey = new PublicKey(userAddress);
      const ownerPubkey = new PublicKey(ownerAddress);

      const transaction = await this.bpMarketSDK.lockUser(
        userPubkey,
        ownerPubkey
      );

      return {
        success: true,
        transaction: transaction,
        user: userAddress,
        owner: ownerAddress,
      };
    } catch (error) {
      console.error('Error locking user:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Unlock a user on Solana
   * @param {string} userAddress - User wallet address to unlock
   * @param {string} ownerAddress - Owner wallet address (with unlock permission)
   * @returns {Object} Transaction object
   */
  async unlockUser(userAddress, ownerAddress) {
    try {
      const userPubkey = new PublicKey(userAddress);
      const ownerPubkey = new PublicKey(ownerAddress);

      const transaction = await this.bpMarketSDK.unlockUser(
        userPubkey,
        ownerPubkey
      );

      return {
        success: true,
        transaction: transaction,
        user: userAddress,
        owner: ownerAddress,
      };
    } catch (error) {
      console.error('Error unlocking user:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
let solanaServiceInstance = null;

const getSolanaService = () => {
  if (!solanaServiceInstance) {
    solanaServiceInstance = new SolanaService();
  }
  return solanaServiceInstance;
};

module.exports = {
  SolanaService,
  getSolanaService,
};
