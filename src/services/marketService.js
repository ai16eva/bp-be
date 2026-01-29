const { BPMarketSDK } = require('../solana-sdk/dist/BPMarket');
const { Connection, PublicKey } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { handleSolanaError } = require('../utils/solanaErrorHandler');

class MarketService {
  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );
    this.sdk = new BPMarketSDK(this.connection);
  }

  async lockWalletAddress(userWallet, ownerWallet) {
    try {
      const userPubkey = new PublicKey(userWallet);
      const ownerPubkey = new PublicKey(ownerWallet);

      const tx = await this.sdk.lockUser(userPubkey, ownerPubkey);

      return {
        transaction: tx,
        message: 'Lock transaction created. Need to sign and send.',
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async unlockWalletAddress(userWallet, ownerWallet) {
    try {
      const userPubkey = new PublicKey(userWallet);
      const ownerPubkey = new PublicKey(ownerWallet);

      const tx = await this.sdk.unlockUser(userPubkey, ownerPubkey);

      return {
        transaction: tx,
        message: 'Unlock transaction created. Need to sign and send.',
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async getMarketInfo(marketKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const info = await this.sdk.getMarketInfo(marketKeyBN);

      return {
        creator: info.creator.toString(),
        title: info.title,
        status: info.status,
        totalTokens: info.totalTokens.toString(),
        remainTokens: info.remainTokens.toString(),
        rewardBaseTokens: info.rewardBaseTokens.toString(),
        correctAnswerKey: info.correctAnswerKey
          ? info.correctAnswerKey.toString()
          : null,
        approveTime: info.approveTime.toString(),
        successTime: info.successTime.toString(),
        adjournTime: info.adjournTime.toString(),
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async getMarketStatus(marketKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const status = await this.sdk.getMarketStatus(marketKeyBN);
      return { status };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async getAllMarkets() {
    try {
      const markets = await this.sdk.getAllMarkets();

      return markets.map((market) => ({
        publicKey: market.publicKey.toString(),
        marketKey: market.account.marketKey.toString(),
        creator: market.account.creator.toString(),
        title: market.account.title,
        status: Object.keys(market.account.status)[0],
        totalTokens: market.account.marketTotalTokens.toString(),
      }));
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async getMarketFee(marketKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const fees = await this.sdk.getMarketFee(marketKeyBN);

      return {
        creatorFee: fees.creatorFee.toString(),
        creatorFeePercentage: fees.creatorFeePercentage.toString(),
        serviceFeePercentage: fees.serviceFeePercentage.toString(),
        charityFeePercentage: fees.charityFeePercentage.toString(),
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  /**
   * Check if bet is available for given parameters
   * Validates: market status, answer existence, user balance, user lock status
   */
  async isBetAvailable(marketKey, answerKey, voterAddress, amount) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);
      const voterPubkey = new PublicKey(voterAddress);
      const amountBN = new BN(amount);

      const result = await this.sdk.isBetAvailable(
        marketKeyBN,
        answerKeyBN,
        voterPubkey,
        amountBN
      );

      return {
        available: result.available,
        reasons: result.reasons,
      };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }

  /**
   * Check if market tokens can be retrieved (180 days rule)
   * Returns true if market is in success/adjourn status for at least 180 days
   */
  async isRetrievable(marketKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const result = await this.sdk.isRetrievable(marketKeyBN);
      return { isRetrievable: result };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }

  async getAnswerInfo(marketKey, answerKey) {
    try {
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);

      const info = await this.sdk.getAnswerInfo(marketKeyBN, answerKeyBN);

      if (!info) {
        throw new Error('Answer not found');
      }

      return {
        totalTokens: info.totalTokens.toString(),
        percentage: info.percentage,
      };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }

  async getUserBetInfo(walletAddress, marketKey, answerKey) {
    try {
      const voterPubkey = new PublicKey(walletAddress);
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);

      const info = await this.sdk.getUserBetInfo(
        voterPubkey,
        marketKeyBN,
        answerKeyBN
      );

      return {
        exists: info.exists,
        tokens: info.tokens.toString(),
        createTime: info.createTime.toString(),
        potentialWinnings: info.potentialWinnings
          ? info.potentialWinnings.toString()
          : null,
      };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }

  async calculateWinnings(walletAddress, marketKey, answerKey) {
    try {
      const voterPubkey = new PublicKey(walletAddress);
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);

      const winnings = await this.sdk.calculateWinnings(
        voterPubkey,
        marketKeyBN,
        answerKeyBN
      );

      return {
        winnings: winnings ? winnings.toString() : '0',
        canClaim: winnings && !winnings.isZero(),
      };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }

  async availableReceiveTokens(walletAddress, marketKey, answerKey) {
    try {
      const voterPubkey = new PublicKey(walletAddress);
      const marketKeyBN = new BN(marketKey);
      const answerKeyBN = new BN(answerKey);

      const available = await this.sdk.availableReceiveTokensByUser(
        voterPubkey,
        marketKeyBN,
        answerKeyBN
      );

      return {
        available: available.toString(),
        canReceive: !available.isZero(),
      };
    } catch (error) {
      throw this.handleSolanaError(error);
    }
  }
}

module.exports = new MarketService();
