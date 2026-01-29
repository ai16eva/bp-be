const path = require('path');
require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'dev'}`),
});
require('dotenv').config();

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} = require('@solana/web3.js');

const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getMint,
} = require('@solana/spl-token');

const { BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const { handleSolanaError } = require('../utils/solanaErrorHandler');
const solanaTxService = require('./solanaTxService');

class DailyRewardService {
  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    this.solanaService = solanaTxService;
    this.rewardWalletKeypair = this.loadRewardWalletKeypair();
    this.tokenMint = new PublicKey(process.env.BASE_TOKEN_MINT);
    this.amount = process.env.DAILY_REWARD_AMOUNT || '1';
    this.decimals = null;
  }

  async init() {
    try {
      const mintInfo = await getMint(this.connection, this.tokenMint);
      this.decimals = mintInfo.decimals;
    } catch (error) {
      throw error;
    }
  }

  loadRewardWalletKeypair() {
    try {
      const privateKeyString =
        process.env.SOLANA_DAILY_REWARD_WALLET_PRIVATE_KEY ||
        process.env.SOLANA_REWARD_WALLET_PRIVATE_KEY;
      if (!privateKeyString)
        throw new Error('Missing reward wallet private key');

      const secretBytes = privateKeyString.startsWith('[')
        ? Uint8Array.from(JSON.parse(privateKeyString))
        : bs58.decode(privateKeyString);

      return Keypair.fromSecretKey(secretBytes);
    } catch (error) {
      console.error(
        '[DailyRewardService] Error loading reward wallet keypair:',
        error
      );
      throw error;
    }
  }

  async claimDailyReward(walletAddress) {
    try {
      if (!this.decimals) {
        throw new Error(
          'Service not initialized. Call init() before claimDailyReward()'
        );
      }

      const userPubkey = new PublicKey(walletAddress);
      const rewardWallet = this.rewardWalletKeypair.publicKey;

      const amountNum = parseFloat(this.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(
          `Invalid DAILY_REWARD_AMOUNT: "${this.amount}". Must be a positive number.`
        );
      }

      const amountLamports = Math.floor(
        amountNum * Math.pow(10, this.decimals)
      );

      const fromTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        rewardWallet
      );
      const toTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        userPubkey
      );

      const transaction = new Transaction();
      const toAccountInfo = await this.connection.getAccountInfo(
        toTokenAccount
      );

      if (!toAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            rewardWallet,
            toTokenAccount,
            userPubkey,
            this.tokenMint
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          rewardWallet,
          amountLamports,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const result = await this.solanaService.sendAndConfirmTransaction(
        transaction,
        [this.rewardWalletKeypair]
      );

      return {
        signature: result.signature,
        success: true,
        amount: this.amount,
        decimals: this.decimals,
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }

  async getRewardWalletBalance() {
    try {
      const tokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        this.rewardWalletKeypair.publicKey
      );
      const balance = await this.connection.getTokenAccountBalance(
        tokenAccount
      );
      return {
        balance: balance.value.uiAmount,
        decimals: balance.value.decimals,
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }
}

const dailyRewardService = new DailyRewardService();
dailyRewardService.init().catch((err) => {
  console.error('Failed to initialize DailyRewardService:', err);
});

module.exports = dailyRewardService;
