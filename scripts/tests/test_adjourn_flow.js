try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) {}

const { PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { initTestEnv, sendSol } = require('../helpers/testHelpers');
const { ensureQuestExists, ensureAnswersExist } = require('../helpers/setupQuestForTest');
const models = require('../../src/models/mysql');
const { spawn } = require('child_process');
const { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction
} = require('@solana/spl-token');

(async () => {
  const env = initTestEnv();
  let questKeyStr = env.questKeyStr;
  if (!questKeyStr) { 
    console.error('Missing --questKey (or pass --auto)'); 
    process.exit(1); 
  }

  const { connection, gov, admin, authority, callApi } = env;
  const questKey = new BN(String(questKeyStr));

  console.log('adjourn flow test');
  console.log(`QuestKey: ${questKeyStr}`);
  console.log(`BaseURL: ${env.baseURL}`);
  console.log('');

  console.log('setup quest to FINISH');
  try {
    await ensureQuestExists(questKeyStr, {
        quest_title: `Quest ${questKeyStr} (Adjourn Test)`,
        quest_description: 'Auto quest for adjourn test',
      quest_status: 'DRAFT',
      quest_creator: env.adminWallet,
    });
    await ensureAnswersExist(questKeyStr, 2);
    
    // Ensure quest_pending is false (like test_ui_full_flow.js)
    const quest = await models.quests.findOne({ where: { quest_key: questKeyStr } });
    if (quest && quest.quest_pending !== false) {
      await quest.update({ quest_pending: false });
      console.log('  Set quest_pending to false');
    }
    
    console.log('  DB quest and answers ready');
  } catch (e) { 
    console.log('    Setup warn:', e.message); 
  }

  console.log('');
  console.log('on-chain setup (config governance)');
  // Setup governance config - voters will be prepared by vote_three_times.js
  try {
    let setNftTx = await gov.setMinimumNfts(1, authority);
    let setVoteTx = await gov.setTotalVote(new BN(2), new BN(10), authority);
    let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    setNftTx.feePayer = admin.publicKey; setNftTx.recentBlockhash = blockhash; setNftTx.sign(admin);
    await connection.sendRawTransaction(setNftTx.serialize(), { skipPreflight: true, maxRetries: 2 })
      .then(sig => connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed'));
    setVoteTx.feePayer = admin.publicKey; setVoteTx.recentBlockhash = blockhash; setVoteTx.sign(admin);
    await connection.sendRawTransaction(setVoteTx.serialize(), { skipPreflight: true, maxRetries: 2 })
      .then(sig => connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed'));
    console.log('  Governance config set');
  } catch (e) { 
    console.log('    Config setup warn:', e.message); 
  }

  console.log('');
  console.log('create governance item');
  // Setup admin NFT and checkpoint (must exist before creating quest, like frontend flow)
  let creatorNftAccount;
  try {
    // Ensure admin has enough SOL and WSOL liquidity before creating governance item
    const MIN_ADMIN_SOL = 5e8; // 0.5 SOL
    const adminSol = await connection.getBalance(admin.publicKey, { commitment: 'confirmed' });
    if (adminSol < MIN_ADMIN_SOL) {
      console.error(`  ❌ Admin SOL balance too low: ${(adminSol/1e9).toFixed(4)} SOL (need >= 0.5 SOL). Please top up admin wallet.`);
      process.exit(1);
    }
    // Pre-wrap ~0.1 SOL to WSOL to satisfy potential token checks
    try {
      const adminWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, admin.publicKey);
      const info = await connection.getAccountInfo(adminWsolAta, 'confirmed');
      const wrapLamports = 1e8; // 0.1 SOL
      const txWrap = new Transaction();
      if (!info) {
        txWrap.add(createAssociatedTokenAccountInstruction(
          admin.publicKey,
          adminWsolAta,
          admin.publicKey,
          NATIVE_MINT
        ));
      }
      txWrap.add(SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: adminWsolAta,
        lamports: wrapLamports,
      }));
      txWrap.add(createSyncNativeInstruction(adminWsolAta));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      txWrap.feePayer = admin.publicKey;
      txWrap.recentBlockhash = blockhash;
      txWrap.sign(admin);
      const wrapSig = await connection.sendRawTransaction(txWrap.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: wrapSig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log('  Pre-wrapped 0.1 SOL to WSOL for admin, tx:', wrapSig);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log('  Warn: Failed to pre-wrap WSOL for admin (continuing):', e?.message || e);
    }

    const adminWalletStr = admin.publicKey.toBase58();
    const adminNftRecord = await models.governance_nft_owners.findOne({
      where: { owner_wallet: adminWalletStr },
      order: [['updated_at', 'DESC']],
    });

    if (!adminNftRecord || !adminNftRecord.token_account) {
      console.error('  ❌ Admin NFT token account not found in DB.');
      console.error('     Please ensure admin has a governance NFT and run scripts/index_with_helius_das.js.');
      process.exit(1);
    }

    creatorNftAccount = new PublicKey(adminNftRecord.token_account);

    // Ensure token account exists on-chain
    let accountReady = false;
    for (let i = 0; i < 10; i++) {
      const accountInfo = await connection.getAccountInfo(creatorNftAccount, 'confirmed');
      if (accountInfo) {
        accountReady = true;
        break;
      }
      if (i < 9) {
        console.log(`  Waiting for creator NFT token account (retry ${i + 1}/10)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!accountReady) {
      console.error(`  Token account ${creatorNftAccount.toBase58()} not found on-chain. Make sure indexing is up to date.`);
      process.exit(1);
    }

    // Ensure checkpoint includes this NFT account
    let needsCheckpoint = true;
    try {
      const checkpoint = await gov.fetchVoterCheckpoints(admin.publicKey);
      const accounts =
        checkpoint?.nftTokenAccounts ??
        checkpoint?.nft_token_accounts ??
        [];
      needsCheckpoint = !accounts.some(acc => {
        const accStr = acc?.toBase58 ? acc.toBase58() : acc?.toString?.() ?? acc;
        return accStr === creatorNftAccount.toBase58();
      });
    } catch (_) {}

    if (needsCheckpoint) {
      console.log('  Admin checkpoint missing, creating checkpoint...');
      const txChk = await gov.updateVoterCheckpoint(admin.publicKey, [creatorNftAccount]);
      const { blockhash: chkBh, lastValidBlockHeight: chkLvh } = await connection.getLatestBlockhash('confirmed');
      txChk.feePayer = admin.publicKey;
      txChk.recentBlockhash = chkBh;
      txChk.sign(admin);
      const chkSig = await connection.sendRawTransaction(txChk.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: chkSig, blockhash: chkBh, lastValidBlockHeight: chkLvh }, 'finalized');
      console.log('  Admin checkpoint updated, tx:', chkSig);
      await new Promise(r => setTimeout(r, 1000));
    } else {
      console.log('  Admin checkpoint already up-to-date');
    }

    console.log('  Creator NFT account:', creatorNftAccount.toBase58());
  } catch (e) {
    console.error('Failed to setup admin NFT/checkpoint:', e?.message || e);
    if (e?.logs) console.error('Transaction logs:', e.logs);
    process.exit(1);
  }

  // Try to create governance item with retry (NFT account may need time to be available)
  let cg;
  let governanceItemCreated = false;
  for (let retry = 0; retry < 5; retry++) {
    if (retry > 0) {
      console.log(`  Retry ${retry}/5 creating governance item...`);
      await new Promise(r => setTimeout(r, 3000));
    }
    cg = await callApi('patch', `/quest-dao/${questKeyStr}/create-governance-item`, { creatorNftAccount: creatorNftAccount.toString() }, 'create-governance-item');
    if (cg.ok) {
      governanceItemCreated = true;
      break;
    } else {
      const errorMsg = cg.data?.message || JSON.stringify(cg.data);
      if (errorMsg.includes('does not exist') || errorMsg.includes('not yet available')) {
        // NFT account not ready yet, will retry
        continue;
      } else {
        // Other error
        if (retry === 4) {
          console.error('  Failed to create governance item after 5 retries:', errorMsg);
          process.exit(1);
        }
      }
    }
  }
  
  if (!governanceItemCreated || !cg.ok) { 
    console.error('  Failed to create governance item. Response:', cg.data);
    process.exit(1); 
  }
  // If backend returned a transaction, submit it (compat with some modes)
  try {
    const txB64 = cg?.data?.data?.transactionBase64 || cg?.data?.transaction;
    if (txB64 && typeof txB64 === 'string') {
      // Clean base64 string (remove whitespace, handle URL-safe)
      const cleanB64 = txB64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      try {
        const txBuffer = Buffer.from(cleanB64, 'base64');
        const tx = Transaction.from(txBuffer);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.feePayer = admin.publicKey; 
        tx.recentBlockhash = blockhash; 
        tx.partialSign(admin);
        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'finalized');
        console.log('  Governance item transaction submitted:', sig);
      } catch (txErr) {
        console.warn('  Failed to submit governance item transaction (may already be submitted):', txErr?.message || txErr);
      }
    } else {
      console.log('  No transaction returned from backend (may use client-side signing)');
    }
  } catch (err) {
    console.warn('  Error processing governance item transaction:', err?.message || err);
  }

  // Wait for governance item PDA to be ready
  console.log('  Waiting for governance item PDA to be ready...');
  await new Promise(r => setTimeout(r, 3000));
  for (let i = 0; i < 5; i++) {
    try {
      const item = await gov.fetchGovernanceItem(questKey);
      if (item && (item.questKey || item.quest_key)) {
        console.log('  Governance item PDA is ready');
        break;
      }
    } catch (_) {}
    if (i < 4) await new Promise(r => setTimeout(r, 2000));
    }

  console.log('');
  console.log('draft vote x3 (use vote_three_times.js)');
  try {
    await new Promise((resolve, reject) => {
      const cp = spawn('node', ['scripts/tools/vote_three_times.js', '--questKey', questKeyStr], { 
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env
      });
      cp.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`vote_three_times exited with code ${code}`));
        }
      });
      cp.on('error', (err) => {
        reject(new Error(`vote_three_times spawn failed: ${err.message}`));
      });
    });
  } catch (e) {
    console.error('  Draft vote failed:', e?.message || e);
    process.exit(1);
  }

  console.log('');
  console.log('force draft end');
  const fd = await callApi('patch', `/quest-dao/${questKeyStr}/draft-end`, { durationSeconds: 0 }, 'force-draft-end');
  if (!fd.ok) {
    console.log('    Force draft end failed:', fd.data);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 4000));

  console.log('');
  console.log('set draft result');
  const sd = await callApi('patch', `/quest-dao/${questKeyStr}/draft/set`, undefined, 'set-draft-result');
  if (!sd.ok) {
    console.log('    Set draft result failed:', sd.data);
    process.exit(1);
  }

  console.log('');
  console.log('publish quest');
  const pb = await callApi('patch', `/quest-dao/${questKeyStr}/publish`, undefined, 'publish');
  if (!pb.ok) {
    console.log('    Publish failed:', pb.data);
    process.exit(1);
  }

  console.log('');
  console.log('publish market');
  const { BPMarketSDK } = require('../../src/solana-sdk/dist/BPMarket');
  const bpMarketSDK = new BPMarketSDK(connection);
  
  try {
    const quest = await models.quests.findOne({ where: { quest_key: questKeyStr } });
    const answers = await models.answers.findAll({ where: { quest_key: questKeyStr } });
    const answerKeys = answers.map(a => Number(a.answer_key)).filter(k => Number.isFinite(k));
    
    if (quest && answerKeys.length > 0) {
      const season = quest.season || {};
      const marketData = {
        marketKey: questKey,
        creator: new PublicKey(quest.quest_creator || env.adminWallet),
        title: quest.quest_title || `Quest ${questKeyStr}`,
        createFee: 0,
        creatorFeePercentage: season.creator_fee || 0,
        serviceFeePercentage: season.service_fee || 0,
        charityFeePercentage: season.charity_fee || 0,
        answerKeys: answerKeys.map(k => new BN(k)),
      };
      
      const publishMarketTx = await bpMarketSDK.publishMarket(marketData, admin.publicKey);
      const { blockhash: marketBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      publishMarketTx.feePayer = admin.publicKey;
      publishMarketTx.recentBlockhash = marketBlockhash;
      publishMarketTx.sign(admin);
      const marketSig = await connection.sendRawTransaction(publishMarketTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: marketSig, blockhash: marketBlockhash, lastValidBlockHeight }, 'confirmed');
      console.log('  Market published, tx:', marketSig);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('    Failed to publish market (may already exist):', e.message);
  }
  
  console.log('');
  console.log('setup betters and place bets');
  try {
    const config = await bpMarketSDK.fetchConfig();
    const baseToken = config.baseToken;
    const isWSOL = baseToken.equals ? baseToken.equals(NATIVE_MINT) : (String(baseToken) === String(NATIVE_MINT));
    
    // Load voters from keys folder
    const fs = require('fs');
    const path = require('path');
    const keysDir = path.resolve(__dirname, '../keys');
    const voter1Path = path.join(keysDir, 'voter1.json');
    const voter2Path = path.join(keysDir, 'voter2.json');
    const voter3Path = path.join(keysDir, 'voter3.json');
    
    function readKeypairFromFile(filePath) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const arr = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    
    const better1 = readKeypairFromFile(voter1Path);
    const better2 = readKeypairFromFile(voter2Path);
    const better3 = readKeypairFromFile(voter3Path);
    
    console.log('  Using voters from keys folder:', {
      better1: better1.publicKey.toBase58(),
      better2: better2.publicKey.toBase58(),
      better3: better3.publicKey.toBase58()
    });

    async function getTokenAmount(tokenAccountPubkey) {
      try {
        const bal = await connection.getTokenAccountBalance(tokenAccountPubkey, 'confirmed');
        return BigInt(bal?.value?.amount || '0');
      } catch {
        return 0n;
      }
    }

    async function ensureAta(ownerPubkey, mintPubkey) {
      const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
      const info = await connection.getAccountInfo(ata, 'confirmed');
      if (!info) {
        const ix = createAssociatedTokenAccountInstruction(
          admin.publicKey,
          ata,
          ownerPubkey,
          mintPubkey
        );
        const tx = new Transaction().add(ix);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        tx.feePayer = admin.publicKey;
        tx.recentBlockhash = blockhash;
        tx.sign(admin);
        await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
        await new Promise(r => setTimeout(r, 800));
      }
      return ata;
    }

    async function wrapSolToAdmin(requiredLamports) {
      // Create/get admin WSOL ATA
      const adminWsolAta = await ensureAta(admin.publicKey, NATIVE_MINT);
      // Transfer SOL into WSOL ATA
      const transferLamports = BigInt(requiredLamports);
      const tx = new Transaction()
        .add(SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: adminWsolAta,
          lamports: Number(transferLamports),
        }))
        .add(createSyncNativeInstruction(adminWsolAta));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.sign(admin);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      await new Promise(r => setTimeout(r, 1000));
      return adminWsolAta;
    }
    
    // Fund SOL for betters if needed
    const MIN_SOL = 2e8;
    const bal1 = await connection.getBalance(better1.publicKey, { commitment: 'confirmed' });
    if (bal1 < MIN_SOL) {
      console.log(`  Funding better1 (current: ${bal1 / 1e9} SOL)`);
      await sendSol(connection, admin, better1.publicKey, 3e9);
      await new Promise(r => setTimeout(r, 1000));
    }
    const bal2 = await connection.getBalance(better2.publicKey, { commitment: 'confirmed' });
    if (bal2 < MIN_SOL) {
      console.log(`  Funding better2 (current: ${bal2 / 1e9} SOL)`);
      await sendSol(connection, admin, better2.publicKey, 3e9);
      await new Promise(r => setTimeout(r, 1000));
    }
    const bal3 = await connection.getBalance(better3.publicKey, { commitment: 'confirmed' });
    if (bal3 < MIN_SOL) {
      console.log(`  Funding better3 (current: ${bal3 / 1e9} SOL)`);
      await sendSol(connection, admin, better3.publicKey, 3e9);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Get admin's token account and fund betters with tokens
    const adminTokenAccount = await getAssociatedTokenAddress(baseToken, admin.publicKey);
    const better1TokenAccount = await getAssociatedTokenAddress(baseToken, better1.publicKey);
    const better2TokenAccount = await getAssociatedTokenAddress(baseToken, better2.publicKey);
    const better3TokenAccount = await getAssociatedTokenAddress(baseToken, better3.publicKey);
    
    // Create token accounts for betters if needed
    const better1TokenAccountInfo = await connection.getAccountInfo(better1TokenAccount);
    if (!better1TokenAccountInfo) {
      const createIx = createAssociatedTokenAccountInstruction(
        admin.publicKey,
        better1TokenAccount,
        better1.publicKey,
        baseToken
      );
      const createTx = new Transaction().add(createIx);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      createTx.feePayer = admin.publicKey;
      createTx.recentBlockhash = blockhash;
      createTx.sign(admin);
      await connection.sendRawTransaction(createTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    const better2TokenAccountInfo = await connection.getAccountInfo(better2TokenAccount);
    if (!better2TokenAccountInfo) {
      const createIx = createAssociatedTokenAccountInstruction(
        admin.publicKey,
        better2TokenAccount,
        better2.publicKey,
        baseToken
      );
      const createTx = new Transaction().add(createIx);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      createTx.feePayer = admin.publicKey;
      createTx.recentBlockhash = blockhash;
      createTx.sign(admin);
      await connection.sendRawTransaction(createTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await new Promise(r => setTimeout(r, 1000));
    }

    const better3TokenAccountInfo = await connection.getAccountInfo(better3TokenAccount);
    if (!better3TokenAccountInfo) {
      const createIx = createAssociatedTokenAccountInstruction(
        admin.publicKey,
        better3TokenAccount,
        better3.publicKey,
        baseToken
      );
      const createTx = new Transaction().add(createIx);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      createTx.feePayer = admin.publicKey;
      createTx.recentBlockhash = blockhash;
      createTx.sign(admin);
      await connection.sendRawTransaction(createTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Transfer tokens to betters (1 token each = 1e9 for 9 decimals)
    const betAmount = new BN(1e9); // 1 token
    // Ensure admin has enough base token; if WSOL, wrap SOL if needed
    const needForBetters = 3n * BigInt(betAmount.toString());
    let adminBaseBalance = await getTokenAmount(adminTokenAccount);
    if (adminBaseBalance < needForBetters) {
      if (isWSOL) {
        const deficit = needForBetters - adminBaseBalance;
        // add 0.01 SOL buffer for safety
        const buffer = 10_000_000n;
        await wrapSolToAdmin(deficit + buffer);
        adminBaseBalance = await getTokenAmount(adminTokenAccount);
        if (adminBaseBalance < needForBetters) {
          throw new Error('Admin WSOL balance insufficient after wrapping. Please top up SOL.');
        }
      } else {
        throw new Error('Admin base token balance insufficient and base token is not WSOL.');
      }
    }

    const transfer1Ix = createTransferInstruction(
      adminTokenAccount,
      better1TokenAccount,
      admin.publicKey,
      betAmount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    );
    const transfer1Tx = new Transaction().add(transfer1Ix);
      let { blockhash } = await connection.getLatestBlockhash('confirmed');
    transfer1Tx.feePayer = admin.publicKey;
    transfer1Tx.recentBlockhash = blockhash;
    transfer1Tx.sign(admin);
    await connection.sendRawTransaction(transfer1Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await new Promise(r => setTimeout(r, 1000));
    
    const transfer2Ix = createTransferInstruction(
      adminTokenAccount,
      better2TokenAccount,
      admin.publicKey,
      betAmount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    );
    const transfer2Tx = new Transaction().add(transfer2Ix);
    ({ blockhash } = await connection.getLatestBlockhash('confirmed'));
    transfer2Tx.feePayer = admin.publicKey;
    transfer2Tx.recentBlockhash = blockhash;
    transfer2Tx.sign(admin);
    await connection.sendRawTransaction(transfer2Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await new Promise(r => setTimeout(r, 1000));

    const transfer3Ix = createTransferInstruction(
      adminTokenAccount,
      better3TokenAccount,
      admin.publicKey,
      betAmount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    );
    const transfer3Tx = new Transaction().add(transfer3Ix);
    ({ blockhash } = await connection.getLatestBlockhash('confirmed'));
    transfer3Tx.feePayer = admin.publicKey;
    transfer3Tx.recentBlockhash = blockhash;
    transfer3Tx.sign(admin);
    await connection.sendRawTransaction(transfer3Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('  Funded betters with tokens');
    
    // Get answer keys
    const answers = await models.answers.findAll({ where: { quest_key: questKeyStr } });
    const answerKey1 = new BN(Number(answers[0].answer_key));
    const answerKey2 = new BN(Number(answers[1].answer_key));
    
    // Better1 bets on answer 1
    try {
      const bet1Tx = await bpMarketSDK.bet(questKey, answerKey1, betAmount, better1.publicKey);
      ({ blockhash } = await connection.getLatestBlockhash('confirmed'));
      bet1Tx.feePayer = better1.publicKey;
      bet1Tx.recentBlockhash = blockhash;
      bet1Tx.partialSign(better1);
      const bet1Sig = await connection.sendRawTransaction(bet1Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction(bet1Sig, 'confirmed');
      console.log('  Better1 bet on answer 1, tx:', bet1Sig);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log('    Better1 bet failed:', e?.message || e);
    }
    
    // Better2 bets on answer 2
    try {
      const bet2Tx = await bpMarketSDK.bet(questKey, answerKey2, betAmount, better2.publicKey);
      ({ blockhash } = await connection.getLatestBlockhash('confirmed'));
      bet2Tx.feePayer = better2.publicKey;
      bet2Tx.recentBlockhash = blockhash;
      bet2Tx.partialSign(better2);
      const bet2Sig = await connection.sendRawTransaction(bet2Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction(bet2Sig, 'confirmed');
      console.log('  Better2 bet on answer 2, tx:', bet2Sig);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log('    Better2 bet failed:', e?.message || e);
    }
    
    // Better3 bets on answer 1 (optional, to have more bets)
    try {
      const bet3Tx = await bpMarketSDK.bet(questKey, answerKey1, betAmount, better3.publicKey);
      ({ blockhash } = await connection.getLatestBlockhash('confirmed'));
      bet3Tx.feePayer = better3.publicKey;
      bet3Tx.recentBlockhash = blockhash;
      bet3Tx.partialSign(better3);
      const bet3Sig = await connection.sendRawTransaction(bet3Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction(bet3Sig, 'confirmed');
      console.log('  Better3 bet on answer 1, tx:', bet3Sig);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log('    Better3 bet failed:', e?.message || e);
    }
    
    // Store betters for later claim (only those who successfully bet)
    const storedBetters = {};
    try {
      // Check if better1 bet exists
      const better1BetPDA = bpMarketSDK.getBettingPDA(better1.publicKey, questKey, answerKey1);
      await bpMarketSDK.fetchBetting(better1.publicKey, questKey, answerKey1);
      storedBetters.better1 = { keypair: better1, answerKey: answerKey1, betAmount };
      console.log('  Better1 bet confirmed');
    } catch (e) {
      console.log('    Better1 bet not found on-chain');
    }
    
    try {
      const better2BetPDA = bpMarketSDK.getBettingPDA(better2.publicKey, questKey, answerKey2);
      await bpMarketSDK.fetchBetting(better2.publicKey, questKey, answerKey2);
      storedBetters.better2 = { keypair: better2, answerKey: answerKey2, betAmount };
      console.log('  Better2 bet confirmed');
    } catch (e) {
      console.log('    Better2 bet not found on-chain');
    }
    
    try {
      await bpMarketSDK.fetchBetting(better3.publicKey, questKey, answerKey1);
      storedBetters.better3 = { keypair: better3, answerKey: answerKey1, betAmount };
      console.log('  Better3 bet confirmed');
    } catch (e) {
      console.log('    Better3 bet not found on-chain');
    }
    
    global.__ADJOURN_BETTERS__ = storedBetters;
    console.log('  Bets placed successfully');
    console.log('  Stored betters for claim:', {
      better1: better1.publicKey.toBase58(),
      better2: better2.publicKey.toBase58()
    });
  } catch (e) {
    console.log('    Bet setup error:', e?.message || e);
    if (e?.stack) console.log('    Stack:', e.stack);
    // Don't exit, continue with test even if betting fails
  }
  
  await callApi('patch', `/quest-dao/${questKeyStr}/finish`, undefined, 'finish');
  console.log('  Quest is now FINISH');

  console.log('');
  console.log('adjourn');

  console.log('');
  console.log('start decision phase');
  const ss = await callApi('patch', `/quest-dao/${questKeyStr}/dao-success`, undefined, 'start-decision');
  if (!ss.ok) {
    console.log('    Start decision failed:', ss.data);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 3000));

  console.log('');
  console.log('decision vote x3 (ADJOURN, ADJOURN, ADJOURN)');
  // Use existing voters (must have NFT + checkpoint); fetch from DB and ensure checkpoint exists
  try {
    const fs = require('fs');
    const path = require('path');
    const keysDir = path.resolve(__dirname, '../keys');
    const keyFiles = [
      path.join(keysDir, 'voter1.json'),
      path.join(keysDir, 'voter2.json'),
      path.join(keysDir, 'voter3.json'),
    ];
    
    function readKeypairFromFile(filePath) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const arr = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    
    const voterKeypairs = keyFiles.map(readKeypairFromFile);
    
    async function getNftAccountFromDb(publicKey) {
      const wallet = publicKey.toBase58();
      const record = await models.governance_nft_owners.findOne({
        where: { owner_wallet: wallet },
        order: [['updated_at', 'DESC']],
      });
      if (!record || !record.token_account) {
        throw new Error(`NFT token account not found in DB for voter ${wallet}. Run scripts/index_with_helius_das.js to sync.`);
      }
      return new PublicKey(record.token_account);
    }

    async function waitForTokenAccount(pubkey) {
      for (let i = 0; i < 10; i++) {
        const info = await connection.getAccountInfo(pubkey, 'confirmed');
        if (info) return;
        if (i < 9) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      throw new Error(`Token account ${pubkey.toBase58()} not found on-chain`);
    }

    async function ensureCheckpoint(keypair, nftAccount, indexLabel) {
      let hasCheckpoint = false;
      try {
        const checkpoint = await gov.fetchVoterCheckpoints(keypair.publicKey);
        const accounts =
          checkpoint?.nftTokenAccounts ??
          checkpoint?.nft_token_accounts ??
          [];
        hasCheckpoint = accounts.some(acc => {
          const accStr = acc?.toBase58 ? acc.toBase58() : acc?.toString?.() ?? acc;
          return accStr === nftAccount.toBase58();
        });
      } catch (_) {}

      if (!hasCheckpoint) {
        console.log(`   Creating checkpoint for voter ${indexLabel}...`);
        const txChk = await gov.updateVoterCheckpoint(keypair.publicKey, [nftAccount]);
        const { blockhash: chkBh, lastValidBlockHeight: chkLvh } = await connection.getLatestBlockhash('confirmed');
        txChk.feePayer = keypair.publicKey;
        txChk.recentBlockhash = chkBh;
        txChk.partialSign(keypair);
        const chkSig = await connection.sendRawTransaction(txChk.serialize(), { skipPreflight: true, maxRetries: 2 });
        await connection.confirmTransaction({ signature: chkSig, blockhash: chkBh, lastValidBlockHeight: chkLvh }, 'finalized');
        console.log(`   Checkpoint created for voter ${indexLabel}, tx:`, chkSig);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const voters = [];
    for (let i = 0; i < voterKeypairs.length; i++) {
      const voter = voterKeypairs[i];
      const bal = await connection.getBalance(voter.publicKey, { commitment: 'confirmed' });
      if (bal < 2e8) {
        await sendSol(connection, admin, voter.publicKey, 3e9);
        await new Promise(r => setTimeout(r, 800));
      }

      const nftAccount = await getNftAccountFromDb(voter.publicKey);
      await waitForTokenAccount(nftAccount);
      await ensureCheckpoint(voter, nftAccount, i + 1);

      voters.push({
        keypair: voter,
        nftAccount,
      });
      console.log(`   Voter ${i + 1} NFT account:`, nftAccount.toBase58());
    }
    
    if (voters.length < 2) {
      throw new Error(`Need at least 2 voters, found ${voters.length}`);
    }
    
    // Vote ADJOURN for all voters
    for (let i = 0; i < Math.min(voters.length, 3); i++) {
      const voter = voters[i];
      console.log(`     Voter ${i + 1} voting ADJOURN...`);
      let voteTx = await gov.voteDecision(questKey, 'adjourn', voter.keypair.publicKey, voter.nftAccount);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      voteTx.feePayer = voter.keypair.publicKey;
      voteTx.recentBlockhash = blockhash;
      voteTx.partialSign(voter.keypair);
      let sig = await connection.sendRawTransaction(voteTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'finalized');
      console.log(`     Voter ${i + 1} voted ADJOURN, tx:`, sig);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log('  Waiting for PDA sync...');
    await new Promise(r => setTimeout(r, 6000));
    
    // Verify on-chain counts
    try {
      const dv = await gov.fetchDecisionVote(questKey);
      const success = dv?.countSuccess?.toNumber?.() || dv?.count_success || 0;
      const adjourn = dv?.countAdjourn?.toNumber?.() || dv?.count_adjourn || 0;
      const total = dv?.totalVoted?.toNumber?.() || dv?.total_voted || 0;
      console.log('  Decision vote counts:', { success, adjourn, total });
      } catch (e) {
        console.log('    Failed to verify decision vote:', e.message);
      }
  } catch (e) {
    console.error('  Decision vote failed:', e?.message || e);
    process.exit(1);
  }

  console.log('');
  console.log('force decision end');
  const fe = await callApi('patch', `/quest-dao/${questKeyStr}/dao-success-end`, { durationSeconds: 0 }, 'force-decision-end');
  if (!fe.ok) {
    console.log('    Force decision end failed:', fe.data);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 5000));

  console.log('');
  console.log('set decision result (should be ADJOURN)');
  const setDecisionRes = await callApi('patch', `/quest-dao/${questKeyStr}/dao-success/set`, undefined, 'set-decision');
  if (!setDecisionRes.ok) {
    console.log('    Set decision failed:', setDecisionRes.data);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 3000));

  await new Promise(r => setTimeout(r, 1000));
  const questStatus = await models.quests.findOne({ 
    where: { quest_key: questKeyStr },
    attributes: ['quest_status', 'dao_answer_tx']
  });
  
  console.log('');
  console.log('Quest status after decision:', {
    quest_status: questStatus?.quest_status,
    dao_answer_tx: questStatus?.dao_answer_tx
  });

  if (questStatus && questStatus.quest_status === 'ADJOURN') {
    console.log('Decision result: ADJOURN - Proceed to adjourn quest');

    console.log('');
    console.log('adjourn quest');
    const adjournRes = await callApi('patch', `/quest-dao/${questKeyStr}/adjourn`, undefined, 'adjourn-quest');
    
    if (adjournRes.ok) {  
      await new Promise(r => setTimeout(r, 2000));
      const finalQuest = await models.quests.findOne({ 
        where: { quest_key: questKeyStr },
        attributes: ['quest_status', 'quest_adjourn_tx', 'quest_adjourn_datetime']
      });
      
      console.log('');
      console.log('adjourn quest completed');
      console.log('Final status:', {
        quest_status: finalQuest?.quest_status,
        quest_adjourn_tx: finalQuest?.quest_adjourn_tx,
        quest_adjourn_datetime: finalQuest?.quest_adjourn_datetime
      });
      
      console.log('');
      console.log('claim betting tokens (refund after adjourn)');
      try {
        const betters = global.__ADJOURN_BETTERS__ || {};
        const betterKeys = Object.keys(betters);
        console.log('  Found betters to claim:', betterKeys.length, betterKeys);
        
        if (betterKeys.length === 0) {
          console.log('    No betters found to claim');
        } else {
          // Claim for each better
          for (const [idx, betterKey] of betterKeys.entries()) {
            const better = betters[betterKey];
            try {
              console.log(`  ${betterKey} claiming refund...`);
              const claimTx = await bpMarketSDK.receiveToken(questKey, better.answerKey, better.keypair.publicKey);
              let { blockhash } = await connection.getLatestBlockhash('confirmed');
              claimTx.feePayer = better.keypair.publicKey;
              claimTx.recentBlockhash = blockhash;
              claimTx.partialSign(better.keypair);
              const claimSig = await connection.sendRawTransaction(claimTx.serialize(), { skipPreflight: true, maxRetries: 2 });
              await connection.confirmTransaction(claimSig, 'confirmed');
              console.log(`  ${betterKey} claimed refund, tx:`, claimSig);
              await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
              console.log(`    ${betterKey} claim failed:`, e?.message || e);
            }
          }
          console.log('  All betters processed');
        }
      } catch (e) {
        console.log('    Claim tokens warn:', e.message);
        if (e.stack) console.log('    Stack:', e.stack);
      }
      
      console.log('');
      console.log('adjourn flow completed');
      console.log('');
      process.exit(0);
    } else {
      console.error('Adjourn quest failed:', adjournRes.data);
      process.exit(1);
    }
  } else {
    console.error('Expected ADJOURN status, got:', questStatus?.quest_status);
    process.exit(1);
  }
})().catch(e => { 
  console.error('Test failed:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1); 
});

