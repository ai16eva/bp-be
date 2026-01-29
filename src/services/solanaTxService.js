const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SYSVAR_CLOCK_PUBKEY,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const bs58 = require('bs58');
const {
  getBPMarketSDK,
  getGovernanceSDK,
  getSolanaConfig,
} = require('../config/solana');
const { convertToBN, convertToPublicKey } = require('../utils/solanaHelpers');
const { handleSolanaError } = require('../utils/solanaErrorHandler');

class SolanaTransactionService {
  constructor() {
    this.config = getSolanaConfig();
    this.connection = new Connection(this.config.rpcUrl, {
      commitment: this.config.commitment,
    });
    this.bpMarketSDK = getBPMarketSDK();
    this.governanceSDK = getGovernanceSDK();
  }

  getAdminKeypair() {
    const privateKeyString =
      process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY ||
      process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV;
    if (!privateKeyString) {
      throw new Error(
        'SOLANA_MASTER_WALLET_PRIVATE_KEY not found in environment variables'
      );
    }

    try {
      const privateKeyArray = JSON.parse(privateKeyString);
      return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } catch (jsonError) {
      try {
        const bs58 = require('bs58');
        const decoded = bs58.decode(privateKeyString);
        return Keypair.fromSecretKey(decoded);
      } catch (base58Error) {
        throw new Error(
          `Invalid admin private key format. Tried JSON and base58: ${privateKeyString.substring(
            0,
            20
          )}...`
        );
      }
    }
  }
  async sendAndConfirm(transaction, signers, options = {}) {
    const {
      computeBudget = null,
      commitment = 'confirmed',
    } = options;

    const {
      addComputeBudget,
    } = require('../utils/solanaTransactionHelpers');

    if (computeBudget === null) {
    } else if (computeBudget !== undefined || process.env.SOLANA_PRIORITY_FEE) {
      const priorityFee =
        computeBudget?.computeUnitPrice ||
        parseInt(process.env.SOLANA_PRIORITY_FEE) ||
        1000;
      const computeLimit =
        computeBudget?.computeUnitLimit ||
        parseInt(process.env.SOLANA_COMPUTE_LIMIT) ||
        200000;
      addComputeBudget(transaction, {
        computeUnitPrice: priorityFee,
        computeUnitLimit: computeLimit,
      });
    }

    try {
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
      }

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        signers,
        {
          commitment,
          skipPreflight: false,
        }
      );

      return {
        signature,
        transactionHash: signature,
        success: true,
        attempts: 1,
      };
    } catch (error) {
      const { handleSolanaError } = require('../utils/solanaErrorHandler');
      const errorInfo = handleSolanaError(error);

      if (
        errorInfo.name === 'BlockhashExpired' ||
        error.message?.includes('block height exceeded')
      ) {
        return {
          success: false,
          error: 'Transaction timeout',
          transactionHash: null,
          errorInfo,
        };
      }

      throw {
        ...errorInfo,
        originalError: error,
      };
    }
  }

  /**
   * Finish market
   */
  async finishMarket(questKey) {
    try {
      const { BPMarketSDK } = require('../solana-sdk/dist/BPMarket');
      const { Connection, PublicKey } = require('@solana/web3.js');
      const BN = require('bn.js');

      const rpcUrl =
        process.env.SOLANA_RPC_URL_DEV ||
        process.env.SOLANA_RPC_URL ||
        'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const bpMarketSDK = new BPMarketSDK(connection);

      const marketKey = new BN(questKey);

      try {
        const market = await bpMarketSDK.fetchMarket(marketKey);
        if (!market.status.approve) {
          throw new Error(`Market ${questKey} is not approved. Cannot finish market. Status: ${JSON.stringify(market.status)}`);
        }
        console.log(`[finishMarket] Market ${questKey} is approved, proceeding with finish`);
      } catch (marketCheckErr) {
        if (marketCheckErr.message && marketCheckErr.message.includes('not approved')) {
          throw marketCheckErr;
        }
        console.warn(`[finishMarket] Could not check market status: ${marketCheckErr.message}`);
      }

      const masterWallet =
        process.env.SOLANA_MASTER_WALLET_DEV ||
        process.env.SOLANA_MASTER_WALLET;
      if (!masterWallet) {
        throw new Error(
          'SOLANA_MASTER_WALLET_DEV or SOLANA_MASTER_WALLET environment variable is required'
        );
      }
      const owner = new PublicKey(masterWallet);

      const transaction = await bpMarketSDK.finishMarket(marketKey, owner);

      const { sendSignedTransaction } = require('./sendSolanaTx');
      return await sendSignedTransaction(transaction);
    } catch (error) {
      console.error('Error in finishMarket:', error);
      throw new Error(`finishMarket failed: ${error.message}`);
    }
  }

  /**
   * Success market
   */
  async successMarket(questKey, answerKey) {
    try {
      try {
        await this.ensureSuccessTokenAccounts(questKey);
      } catch (prepErr) {
        console.warn('ensureSuccessTokenAccounts warning:', prepErr?.message || prepErr);
      }

      const questKeyBN = convertToBN(questKey);
      const answerKeyBN = convertToBN(answerKey);

      try {
        const market = await this.bpMarketSDK.fetchMarket(questKeyBN);
        const isFinished = Boolean(market.status?.finished);

        if (!isFinished) {
          throw new Error(`Market ${questKey} must be finished before success. Current status: ${JSON.stringify(market.status)}. Please call finishMarket first.`);
        }

        console.log(`[successMarket] Market ${questKey} is finished; proceeding with success flow.`);
      } catch (marketCheckErr) {
        if (marketCheckErr.message && (marketCheckErr.message.includes('must be finished') || marketCheckErr.message.includes('not ready for success'))) {
          throw marketCheckErr;
        }
        console.warn(`[successMarket] Could not check market status: ${marketCheckErr.message}`);
      }

      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.bpMarketSDK.successMarket(
        questKeyBN,
        answerKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Success market error:', error);
      throw error;
    }
  }


  async ensureSuccessTokenAccounts(questKey) {
    const { Transaction } = require('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
    } = require('@solana/spl-token');

    const adminKeypair = this.getAdminKeypair();
    const questKeyBN = convertToBN(questKey);

    const config = await this.bpMarketSDK.fetchConfig();
    const marketPDA = this.bpMarketSDK.getMarketPDA(questKeyBN);
    const market = await this.bpMarketSDK.fetchMarket(questKeyBN);

    const bettingToken = market.bettingToken || config.baseToken;

    const owners = [
      { owner: marketPDA, isPDA: true },
      { owner: market.creator, isPDA: false },
      { owner: config.cojamFeeAccount, isPDA: true },
      { owner: config.charityFeeAccount, isPDA: true },
    ];

    const tx = new Transaction();
    for (const { owner, isPDA } of owners) {
      const ata = await getAssociatedTokenAddress(bettingToken, owner, isPDA);
      const info = await this.connection.getAccountInfo(ata);
      if (!info) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            adminKeypair.publicKey,
            ata,
            owner,
            bettingToken,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
    }

    if (tx.instructions.length > 0) {
      const { blockhash } = await this.connection.getRecentBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = adminKeypair.publicKey;
      await this.sendAndConfirm(tx, [adminKeypair]);
    }
  }

  async adjournMarket(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.bpMarketSDK.adjournMarket(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Adjourn market error:', error);
      throw error;
    }
  }

  async retrieveTokens(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const config = await this.bpMarketSDK.fetchConfig();
      const market = await this.bpMarketSDK.fetchMarket(questKeyBN);
      const remainsPDA = config.remainAccount;

      const bettingToken = market.bettingToken || config.baseToken;

      const {
        getAssociatedTokenAddress,
        TOKEN_PROGRAM_ID,
        createAccount,
      } = require('@solana/spl-token');
      let remainsTokenAccount = await getAssociatedTokenAddress(
        bettingToken,
        remainsPDA,
        true
      );

      const ataInfo = await this.connection.getAccountInfo(remainsTokenAccount);
      if (ataInfo && !ataInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        remainsTokenAccount = await createAccount(
          this.connection,
          adminKeypair,
          bettingToken,
          remainsPDA
        );
      }

      const transaction = await this.bpMarketSDK.retrieveTokens(
        questKeyBN,
        remainsTokenAccount,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      // Sign and submit
      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Retrieve tokens error:', error);
      throw error;
    }
  }

  async publishMarket(questKey, marketData) {
    try {
      const { BN: AnchorBN } = require('@coral-xyz/anchor');
      const questKeyBN = new AnchorBN(String(questKey));
      const adminKeypair = this.getAdminKeypair();
      const creatorPubkey = adminKeypair.publicKey;
      const createFeeBN = new AnchorBN(String(marketData.createFee ?? 0));
      const creatorFeeBN = new AnchorBN(
        String(marketData.creatorFeePercentage ?? 0)
      );
      const serviceFeeBN = new AnchorBN(
        String(marketData.serviceFeePercentage ?? 0)
      );
      const charityFeeBN = new AnchorBN(
        String(marketData.charityFeePercentage ?? 0)
      );

      const rawTitle = String(marketData.title || `Quest ${questKey}`);
      const title = rawTitle.length > 64 ? rawTitle.slice(0, 64) : rawTitle;

      // Get betting token from marketData or fallback to config base token
      let bettingToken;
      if (marketData.bettingToken) {
        bettingToken = convertToPublicKey(marketData.bettingToken);
      } else {
        // Fallback to base token from config
        const config = await this.bpMarketSDK.fetchConfig();
        bettingToken = config.baseToken;
      }

      try {
        this.bpMarketSDK.getMarketPDA(questKeyBN);
      } catch (e) {
        throw new Error(`Invalid marketKey BN for PDA: ${e.message}`);
      }

      if (
        !Array.isArray(marketData.answerKeys) ||
        marketData.answerKeys.length === 0
      ) {
        throw new Error('NoAnswersProvided');
      }
      const normalizedAnswerKeys = marketData.answerKeys
        .map((k) =>
          Number.isFinite(Number(k)) ? new AnchorBN(String(k)) : undefined
        )
        .filter((bn) => bn !== undefined);
      if (normalizedAnswerKeys.length === 0) {
        throw new Error('InvalidAnswerKeys');
      }
      console.log(
        'publishMarket: questKey=',
        questKeyBN.toString(),
        'bettingToken=',
        bettingToken.toBase58(),
        'answerKeys.len=',
        marketData.answerKeys.length,
        'normalized=',
        normalizedAnswerKeys.map((b) => b.toString())
      );
      try {
        const typeOf = (v) => Object.prototype.toString.call(v);
        console.log('[publishMarket.args]', {
          marketKey: questKeyBN?.toString?.(),
          marketKeyType: typeOf(questKeyBN),
          creator: creatorPubkey?.toBase58?.(),
          creatorType: typeOf(creatorPubkey),
          title,
          titleType: typeOf(marketData.title),
          bettingToken: bettingToken?.toBase58?.(),
          bettingTokenType: typeOf(bettingToken),
          createFee: createFeeBN?.toString?.(),
          createFeeType: typeOf(createFeeBN),
          creatorFeePercentage: creatorFeeBN?.toString?.(),
          creatorFeeType: typeOf(creatorFeeBN),
          serviceFeePercentage: serviceFeeBN?.toString?.(),
          serviceFeeType: typeOf(serviceFeeBN),
          charityFeePercentage: charityFeeBN?.toString?.(),
          charityFeeType: typeOf(charityFeeBN),
          answerKeysLen: normalizedAnswerKeys.length,
          answerKeys: normalizedAnswerKeys.map((b) => b?.toString?.()),
          answerKeysType: typeOf(normalizedAnswerKeys[0]),
        });
      } catch (_) { }

      const transaction = await this.bpMarketSDK.publishMarket(
        {
          marketKey: questKeyBN,
          creator: creatorPubkey,
          title,
          bettingToken,
          createFee: createFeeBN,
          creatorFeePercentage: creatorFeeBN,
          serviceFeePercentage: serviceFeeBN,
          charityFeePercentage: charityFeeBN,
          answerKeys: normalizedAnswerKeys,
        },
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      try {
        console.error('Publish market error:', {
          message: error?.message,
          stack: error?.stack,
        });
        const dbg = ` | ak.len=${Array.isArray(marketData?.answerKeys)
          ? marketData.answerKeys.length
          : -1
          }`;
        error.message = `${error.message}${dbg}`;
      } catch (_) { }
      if (process.env.E2E_SOLANA_BYPASS === '1') {
        return { signature: 'MOCK_PUBLISH_SIG', bypass: true };
      }
      throw error;
    }
  }

  async publishMarketDirect(questKey, marketData) {
    const anchor = require('@coral-xyz/anchor');
    const { SystemProgram, PublicKey } = require('@solana/web3.js');
    const idl = require('../solana-sdk/dist/utils/idl/bp_market.json');
    const adminKeypair = this.getAdminKeypair();
    const wallet = new anchor.Wallet(adminKeypair);
    const provider = new anchor.AnchorProvider(
      this.connection,
      wallet,
      anchor.AnchorProvider.defaultOptions()
    );
    anchor.setProvider(provider);
    const programId = new PublicKey(idl.address);
    const program = new anchor.Program(idl, programId, provider);

    const marketKeyBN = new anchor.BN(String(questKey));
    const creator = adminKeypair.publicKey;
    const rawTitle = String(marketData.title || `Quest ${questKey}`);
    const title = rawTitle.length > 64 ? rawTitle.slice(0, 64) : rawTitle;
    const createFee = new anchor.BN(String(marketData.createFee ?? 0));
    const creatorFeePercentage = new anchor.BN(
      String(marketData.creatorFeePercentage ?? 0)
    );
    const serviceFeePercentage = new anchor.BN(
      String(marketData.serviceFeePercentage ?? 0)
    );
    const charityFeePercentage = new anchor.BN(
      String(marketData.charityFeePercentage ?? 0)
    );
    const answerKeys = (marketData.answerKeys || []).map(
      (k) => new anchor.BN(String(k))
    );

    const MARKET_SEED = Buffer.from('market');
    const ANSWER_SEED = Buffer.from('answer');
    const CONFIG_SEED = Buffer.from('config');
    const [configPDA] = PublicKey.findProgramAddressSync(
      [CONFIG_SEED],
      program.programId
    );
    const [marketPDA] = PublicKey.findProgramAddressSync(
      [MARKET_SEED, marketKeyBN.toArrayLike(Buffer, 'le', 8)],
      program.programId
    );
    const [answerPDA] = PublicKey.findProgramAddressSync(
      [ANSWER_SEED, marketKeyBN.toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    const signature = await program.methods
      .publishMarket(
        marketKeyBN,
        creator,
        title,
        createFee,
        creatorFeePercentage,
        serviceFeePercentage,
        charityFeePercentage,
        answerKeys
      )
      .accounts({
        owner: adminKeypair.publicKey,
        configAccount: configPDA,
        marketAccount: marketPDA,
        answerAccount: answerPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    return { signature, transactionHash: signature, success: true };
  }


  async setQuestResult(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setQuestResult(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set quest result error:', error);
      throw error;
    }
  }

  async makeQuestResult(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.makeQuestResult(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      // Sign and submit
      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Make quest result error:', error);
      throw error;
    }
  }

  async startDecision(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.startDecision(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Start decision error:', error);
      if (process.env.E2E_SOLANA_BYPASS === '1') {
        return { signature: 'MOCK_START_SIG', bypass: true };
      }
      throw error;
    }
  }

  async setDecision(questKey, answerKeys) {
    try {
      const questKeyBN = convertToBN(questKey);
      const answersBN = answerKeys.map((key) => convertToBN(key));
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setDecisionAndExecuteAnswer(
        questKeyBN,
        answersBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set decision error:', error);
      if (process.env.E2E_SOLANA_BYPASS === '1') {
        return { signature: 'MOCK_DECISION_SIG', bypass: true };
      }
      throw error;
    }
  }

  async makeDecision(questKey, answerKeys) {
    try {
      const questKeyBN = convertToBN(questKey);
      const answersBN = answerKeys.map((key) => convertToBN(key));
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.makeDecisionAndExecuteAnswer(
        questKeyBN,
        answersBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Make decision error:', error);
      throw error;
    }
  }

  async getSelectedAnswerKey(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      return await this.governanceSDK.getSelectedAnswerKey(questKeyBN);
    } catch (error) {
      console.error('Get selected answer key error:', error);
      throw error;
    }
  }

  async setQuestEndTime(questKey, newEndTime) {
    try {
      const questKeyBN = convertToBN(questKey);
      const endTimeBN = convertToBN(newEndTime);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setQuestEndTime(
        questKeyBN,
        endTimeBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set quest end time error:', error);
      throw error;
    }
  }

  async setDecisionEndTime(questKey, newEndTime) {
    try {
      const questKeyBN = convertToBN(questKey);
      const endTimeBN = convertToBN(newEndTime);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setDecisionEndTime(
        questKeyBN,
        endTimeBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set decision end time error:', error);
      throw error;
    }
  }

  async setAnswerEndTime(questKey, newEndTime) {
    try {
      const questKeyBN = convertToBN(questKey);
      const endTimeBN = convertToBN(newEndTime);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setAnswerEndTime(
        questKeyBN,
        endTimeBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set answer end time error:', error);
      throw error;
    }
  }

  async cancelQuest(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.cancelQuest(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Cancel quest error:', error);
      throw error;
    }
  }

  async cancelDecision(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.cancelDecision(
        questKeyBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Cancel decision error:', error);
      throw error;
    }
  }

  async cancelAnswer(questKey, reason) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.cancelAnswer(
        questKeyBN,
        reason,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Cancel answer error:', error);
      throw error;
    }
  }

  async setAnswer(questKey, answerKeys) {
    try {
      const questKeyBN = convertToBN(questKey);
      const answersBN = answerKeys.map((key) => convertToBN(key));
      const adminKeypair = this.getAdminKeypair();

      const transaction = await this.governanceSDK.setAnswer(
        questKeyBN,
        answersBN,
        adminKeypair.publicKey
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      const receipt = await this.sendAndConfirm(transaction, [adminKeypair]);
      return receipt;
    } catch (error) {
      console.error('Set answer error:', error);
      throw error;
    }
  }

  async finalizeAnswer(questKey) {
    try {
      const questKeyBN = convertToBN(questKey);
      const adminKeypair = this.getAdminKeypair();
      const [configPDA] = this.governanceSDK.getConfigPDA();
      const [governanceItemPDA] =
        this.governanceSDK.getGovernanceItemPDA(questKeyBN);
      const [answerVotePDA] = this.governanceSDK.getAnswerVotePDA(questKeyBN);

      const instruction = await this.governanceSDK.program.methods
        .finalizeAnswer(questKeyBN)
        .accountsPartial({
          authority: adminKeypair.publicKey,
          config: configPDA,
          governanceItem: governanceItemPDA,
          answerVote: answerVotePDA,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .instruction();

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.config.commitment || 'confirmed'
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      return await this.sendAndConfirm(transaction, [adminKeypair]);
    } catch (error) {
      console.error('Finalize answer error:', error);
      throw error;
    }
  }

  async sendAndConfirmTransaction(transaction, signers) {
    try {
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash('confirmed');

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signers[0].publicKey;
      transaction.sign(...signers);

      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 0,
        }
      );

      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      return {
        signature,
        confirmed: true,
        blockTime: Date.now(),
      };
    } catch (error) {
      throw handleSolanaError(error);
    }
  }
}

module.exports = new SolanaTransactionService();
