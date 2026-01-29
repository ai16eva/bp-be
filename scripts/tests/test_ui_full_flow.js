try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { BN } = require('@coral-xyz/anchor');
const {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} = require('@solana/web3.js');
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createSyncNativeInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} = require('@solana/spl-token');
const { BPMarketSDK } = require('../../src/solana-sdk/dist/BPMarket');
const { initTestEnv, sendSol } = require('../helpers/testHelpers');
const { ensureQuestExists, ensureAnswersExist } = require('../helpers/setupQuestForTest');
const models = require('../../src/models/mysql');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readKeypairFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const arr = JSON.parse(raw);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

async function waitForAccount(connection, account, label, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const info = await connection.getAccountInfo(account, 'confirmed');
    if (info) {
      return;
    }
    if (i < retries - 1) {
      console.log(`  Waiting for ${label} (retry ${i + 1}/${retries - 1})...`);
      await sleep(delayMs);
    }
  }
  throw new Error(`${label} ${account.toBase58()} not found on-chain`);
}

async function ensureCheckpoint(connection, gov, voterKeypair, nftAccount, indexLabel) {
  let hasCheckpoint = false;
  try {
    const checkpoint = await gov.fetchVoterCheckpoints(voterKeypair.publicKey);
    const accounts =
      checkpoint?.nftTokenAccounts ??
      checkpoint?.nft_token_accounts ??
      [];
    hasCheckpoint = accounts.some((acc) => {
      const accStr = acc?.toBase58 ? acc.toBase58() : acc?.toString?.() ?? acc;
      return accStr === nftAccount.toBase58();
    });
  } catch (_) { }

  if (hasCheckpoint) {
    console.log(`    [checkpoint] voter${indexLabel} already registered`);
    return;
  }

  console.log(`    Creating checkpoint for voter${indexLabel}...`);
  const txChk = await gov.updateVoterCheckpoint(voterKeypair.publicKey, [nftAccount]);
  const { blockhash: chkBh, lastValidBlockHeight: chkLvh } = await connection.getLatestBlockhash('confirmed');
  txChk.feePayer = voterKeypair.publicKey;
  txChk.recentBlockhash = chkBh;
  txChk.partialSign(voterKeypair);
  const chkSig = await connection.sendRawTransaction(txChk.serialize(), { skipPreflight: true, maxRetries: 2 });
  await connection.confirmTransaction({ signature: chkSig, blockhash: chkBh, lastValidBlockHeight: chkLvh }, 'finalized');
  console.log(`    Checkpoint created for voter${indexLabel}, tx:`, chkSig);
  await sleep(1000);
}

async function getNftAccountFromDb(publicKey) {
  const wallet = publicKey.toBase58();
  const record = await models.governance_nft_owners.findOne({
    where: { owner_wallet: wallet },
    order: [['updated_at', 'DESC']],
  });
  if (!record || !record.token_account) {
    throw new Error(`NFT token account not found in DB for wallet ${wallet}. Run scripts/index_with_helius_das.js to sync.`);
  }
  return new PublicKey(record.token_account);
}

async function runChildScript(scriptPath, args, note) {
  console.log(note);
  await new Promise((resolve, reject) => {
    const cp = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });
    cp.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
      }
    });
    cp.on('error', (err) => {
      reject(new Error(`${path.basename(scriptPath)} spawn failed: ${err.message}`));
    });
  });
}

async function ensureAta(connection, admin, ownerPubkey, mintPubkey) {
  const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
  const info = await connection.getAccountInfo(ata, 'confirmed');
  if (!info) {
    const ix = createAssociatedTokenAccountInstruction(
      admin.publicKey,
      ata,
      ownerPubkey,
      mintPubkey,
    );
    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(admin);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    await sleep(800);
  }
  return ata;
}

async function wrapSolIfNeeded(connection, admin, ata, lamports) {
  if (lamports <= 0) return;
  const tx = new Transaction()
    .add(SystemProgram.transfer({
      fromPubkey: admin.publicKey,
      toPubkey: ata,
      lamports,
    }))
    .add(createSyncNativeInstruction(ata));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  await sleep(1000);
  return sig;
}

(async () => {
  const env = initTestEnv();
  let questKeyStr = env.questKeyStr || String(Math.floor(Date.now() / 1000));
  const { connection, gov, admin, adminWallet, callApi } = env;

  console.log('🧪 UI full flow with betting, answer set, claim bet, claim vote reward');
  console.log(`QuestKey: ${questKeyStr}`);
  console.log(`BaseURL: ${env.baseURL}`);

  await ensureQuestExists(questKeyStr, {
    quest_title: `Quest ${questKeyStr} (UI Full Flow)`,
    quest_description: 'Auto quest for UI full flow test',
    quest_status: 'DRAFT',
    quest_creator: adminWallet,
  });
  await ensureAnswersExist(questKeyStr, 2);

  const questRow = await models.quests.findOne({ where: { quest_key: questKeyStr } });
  if (!questRow) {
    console.error('Quest not found in DB after creation.');
    process.exit(1);
  }
  if (questRow.quest_pending !== false) {
    await questRow.update({ quest_pending: false });
    console.log('  Set quest_pending to false');
  }

  const questKey = new BN(String(questKeyStr));

  const bpMarketSDK = new BPMarketSDK(connection);

  // Determine betting token (Custom or Default)
  let bettingToken;
  let isWSOL = false;

  if (process.env.CUSTOM_BETTING_TOKEN) {
    bettingToken = new PublicKey(process.env.CUSTOM_BETTING_TOKEN);
    console.log('🎯 Using CUSTOM betting token from env:', bettingToken.toBase58());
  } else {
    try {
      const config = await bpMarketSDK.fetchConfig();
      bettingToken = config.baseToken ?? config.base_token ?? NATIVE_MINT;
      console.log('🎯 Using DEFAULT betting token from config:', bettingToken.toBase58());
    } catch (e) {
      bettingToken = NATIVE_MINT;
      console.warn('  Warn: Failed to fetch BPMarket config, defaulting to WSOL:', e?.message || e);
    }
  }

  isWSOL = bettingToken.equals ? bettingToken.equals(NATIVE_MINT) : String(bettingToken) === String(NATIVE_MINT);
  console.log(`  Token type: ${isWSOL ? 'WSOL (native)' : 'SPL Token'}`);

  console.log('\n[1] Ensure admin balances and creator NFT');
  const MIN_ADMIN_SOL = 5e8; // 0.5 SOL
  const adminSol = await connection.getBalance(admin.publicKey, { commitment: 'confirmed' });
  if (adminSol < MIN_ADMIN_SOL) {
    console.error(`  ❌ Admin SOL balance too low: ${(adminSol / 1e9).toFixed(4)} SOL (need >= 0.5 SOL). Please top up admin wallet.`);
    process.exit(1);
  }
  console.log(`  Admin SOL balance: ${(adminSol / 1e9).toFixed(4)} SOL`);

  let creatorNftAccount;
  try {
    const adminNftAccount = await getNftAccountFromDb(admin.publicKey);
    await waitForAccount(connection, adminNftAccount, 'creator NFT token account');
    await ensureCheckpoint(connection, gov, admin, adminNftAccount, 'admin');
    creatorNftAccount = adminNftAccount;
    console.log('  Creator NFT account:', creatorNftAccount.toBase58());
  } catch (e) {
    console.error('  ❌ Failed to setup admin NFT / checkpoint:', e?.message || e);
    process.exit(1);
  }

  if (isWSOL) {
    const adminWsolAta = await ensureAta(connection, admin, admin.publicKey, NATIVE_MINT);
    const wsolInfo = await connection.getTokenAccountBalance(adminWsolAta).catch(() => null);
    const amount = BigInt(wsolInfo?.value?.amount || '0');
    const targetLamports = BigInt(1e8); // 0.1 SOL
    if (amount < targetLamports) {
      console.log('  Admin WSOL balance too low, wrapping 0.1 SOL...');
      await wrapSolIfNeeded(connection, admin, adminWsolAta, Number(targetLamports - amount));
    } else {
      console.log(`  Admin WSOL balance: ${(Number(amount) / 1e9).toFixed(4)} SOL`);
    }
  }

  console.log('\n[2] Create governance item (reuse creator NFT from DB)');
  let governanceCreated = false;
  let cg;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry create governance item (${attempt}/4)...`);
      await sleep(3000);
    }
    cg = await callApi('patch', `/quest-dao/${questKeyStr}/create-governance-item`, {
      creatorNftAccount: creatorNftAccount.toBase58(),
    }, 'create-governance-item');
    if (cg.ok) {
      governanceCreated = true;
      break;
    }
    const message = cg.data?.message || JSON.stringify(cg.data);
    if (!message || (!message.includes('does not exist') && !message.includes('not yet available'))) {
      break;
    }
  }

  if (!governanceCreated) {
    console.error('  ❌ Failed to create governance item:', cg?.data || cg);
    process.exit(1);
  }

  try {
    const txB64 = cg?.data?.data?.transactionBase64 || cg?.data?.transaction;
    if (txB64 && typeof txB64 === 'string') {
      const cleanB64 = txB64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const txBuffer = Buffer.from(cleanB64, 'base64');
      const tx = Transaction.from(txBuffer);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.partialSign(admin);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'finalized');
      console.log('  Governance item transaction submitted:', sig);
    }
  } catch (err) {
    console.warn('  Warn: processing governance transaction failed:', err?.message || err);
  }

  console.log('  Waiting for governance item PDA...');
  for (let i = 0; i < 5; i++) {
    try {
      const item = await gov.fetchGovernanceItem(questKey);
      if (item && (item.questKey || item.quest_key)) {
        console.log('  Governance item PDA is ready');
        break;
      }
    } catch (_) { }
    if (i === 4) {
      console.warn('  Governance item PDA not confirmed, continuing...');
    } else {
      await sleep(2000);
    }
  }

  console.log('\n[3] Draft voting');
  await runChildScript('scripts/tools/vote_three_times.js', ['--questKey', questKeyStr], '  Using vote_three_times.js');

  console.log('\n[4] Force draft end / set draft / publish');
  const fd = await callApi('patch', `/quest-dao/${questKeyStr}/draft-end`, { durationSeconds: 0 }, 'force-draft-end');
  if (!fd.ok) process.exit(1);
  await sleep(4000);

  if (!(await callApi('patch', `/quest-dao/${questKeyStr}/draft/set`, undefined, 'set-draft-result')).ok) process.exit(1);
  if (!(await callApi('patch', `/quest-dao/${questKeyStr}/publish`, undefined, 'publish')).ok) process.exit(1);

  console.log('\n[5] Publish market on-chain');
  try {
    const dbQuest = await models.quests.findOne({ where: { quest_key: questKeyStr } });
    const dbAnswers = await models.answers.findAll({ where: { quest_key: questKeyStr }, order: [['answer_key', 'ASC']] });
    const answerKeys = dbAnswers.map((a) => new BN(String(a.answer_key)));
    const publishTx = await bpMarketSDK.publishMarket({
      marketKey: questKey,
      creator: new PublicKey(dbQuest.quest_creator || adminWallet),
      title: dbQuest.quest_title,
      bettingToken: bettingToken,
      createFee: 0,
      creatorFeePercentage: 0,
      serviceFeePercentage: 0,
      charityFeePercentage: 0,
      answerKeys,
    }, admin.publicKey);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    publishTx.feePayer = admin.publicKey;
    publishTx.recentBlockhash = blockhash;
    publishTx.sign(admin);
    const marketSig = await connection.sendRawTransaction(publishTx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: marketSig, blockhash, lastValidBlockHeight }, 'confirmed');
    console.log('  Market published, tx:', marketSig);

    // Verify the token was set correctly
    await sleep(2000);
    const market = await bpMarketSDK.fetchMarket(questKey);
    console.log('  Verification - Market betting token:', market.bettingToken.toBase58());
    if (!market.bettingToken.equals(bettingToken)) {
      throw new Error(`Token mismatch! Expected ${bettingToken.toBase58()}, got ${market.bettingToken.toBase58()}`);
    }
    console.log('  ✅ Token verified correctly!');
  } catch (e) {
    console.log('  Warn: publish market skipped/failed:', e?.message || e);
  }

  console.log('\n[6] Setup betters and place bets');
  const keysDir = path.resolve(__dirname, '../keys');
  const betterKeyFiles = [
    path.join(keysDir, 'voter1.json'),
    path.join(keysDir, 'voter2.json'),
    path.join(keysDir, 'voter3.json'),
  ];
  for (const file of betterKeyFiles) {
    if (!fs.existsSync(file)) {
      console.error(`  ❌ Missing voter key file: ${path.basename(file)}. Provide keypairs with governance NFTs indexed.`);
      process.exit(1);
    }
  }
  const betterKeypairs = betterKeyFiles.map(readKeypairFromFile);
  console.log('  Betters:', betterKeypairs.map((kp, idx) => `better${idx + 1}=${kp.publicKey.toBase58()}`).join(', '));

  async function getTokenAmount(tokenAccount) {
    try {
      const bal = await connection.getTokenAccountBalance(tokenAccount, 'confirmed');
      return BigInt(bal?.value?.amount || '0');
    } catch {
      return 0n;
    }
  }

  const adminTokenAta = await ensureAta(connection, admin, admin.publicKey, bettingToken);
  const BET_AMOUNT = new BN(1e9); // 1 token
  const requiredForBetters = BigInt(BET_AMOUNT.toString()) * BigInt(betterKeypairs.length);
  let adminTokenBalance = await getTokenAmount(adminTokenAta);
  if (adminTokenBalance < requiredForBetters) {
    if (!isWSOL) {
      console.error('  ❌ Admin custom token balance insufficient and token is not WSOL.');
      console.error(`     Need ${(Number(requiredForBetters) / 1e9).toFixed(4)} tokens, have ${(Number(adminTokenBalance) / 1e9).toFixed(4)}`);
      process.exit(1);
    }
    const deficit = requiredForBetters - adminTokenBalance;
    console.log(`  Admin WSOL balance low, wrapping ${(Number(deficit) / 1e9).toFixed(4)} SOL...`);
    await wrapSolIfNeeded(connection, admin, adminTokenAta, Number(deficit + 10_000_000n)); // add buffer
    adminTokenBalance = await getTokenAmount(adminTokenAta);
  }

  const betterInfos = [];
  for (let i = 0; i < betterKeypairs.length; i++) {
    const better = betterKeypairs[i];
    const solBal = await connection.getBalance(better.publicKey, { commitment: 'confirmed' });
    if (solBal < 2e8) {
      console.log(`  Funding better${i + 1} with SOL...`);
      await sendSol(connection, admin, better.publicKey, 3e9);
      await sleep(800);
    }

    const tokenAta = await ensureAta(connection, admin, better.publicKey, bettingToken);
    betterInfos.push({ keypair: better, tokenAta });
  }

  const answers = await models.answers.findAll({
    where: { quest_key: questKeyStr },
    order: [['answer_key', 'ASC']],
  });
  if (answers.length < 2) {
    console.error('  ❌ Need at least 2 answers for betting flow.');
    process.exit(1);
  }
  const answer1Key = new BN(String(answers[0].answer_key));
  const answer2Key = new BN(String(answers[1].answer_key));

  async function transferFromAdmin(toAta) {
    const ix = createTransferInstruction(
      adminTokenAta,
      toAta,
      admin.publicKey,
      BET_AMOUNT.toNumber(),
      [],
      TOKEN_PROGRAM_ID,
    );
    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(admin);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    await sleep(500);
    return sig;
  }

  for (const info of betterInfos) {
    await transferFromAdmin(info.tokenAta);
  }

  const betPlacements = [];
  async function placeBet(betterInfo, answerKey, label) {
    try {
      const betTx = await bpMarketSDK.bet(questKey, answerKey, BET_AMOUNT, betterInfo.keypair.publicKey);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      betTx.feePayer = betterInfo.keypair.publicKey;
      betTx.recentBlockhash = blockhash;
      betTx.partialSign(betterInfo.keypair);
      const sig = await connection.sendRawTransaction(betTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`  ${label} bet placed, tx:`, sig);
      betPlacements.push({
        label,
        answerKey,
        keypair: betterInfo.keypair,
        tokenAta: betterInfo.tokenAta,
      });
      await sleep(1500);
    } catch (e) {
      console.log(`  ${label} bet failed:`, e?.message || e);
    }
  }

  await placeBet(betterInfos[0], answer1Key, 'better1');
  await placeBet(betterInfos[1], answer2Key, 'better2');
  if (betterInfos[2]) {
    await placeBet(betterInfos[2], answer1Key, 'better3');
  }

  global.__UI_FLOW_BETTERS__ = betPlacements;

  console.log('\n[7] Finish quest (on-chain) and start decision');
  if (!(await callApi('patch', `/quest-dao/${questKeyStr}/finish`, undefined, 'finish')).ok) process.exit(1);
  const ss = await callApi('patch', `/quest-dao/${questKeyStr}/dao-success`, undefined, 'start-decision');
  if (!ss.ok) process.exit(1);
  await sleep(3000);

  console.log('\n[8] Decision voting (2 SUCCESS, 1 ADJOURN)');
  await runChildScript('scripts/tools/vote_decision_three_times.js', ['--questKey', questKeyStr], '  Using vote_decision_three_times.js');

  console.log('\n[9] Force decision end & set decision');
  if (!(await callApi('patch', `/quest-dao/${questKeyStr}/dao-success-end`, { durationSeconds: 0 }, 'force-decision-end')).ok) process.exit(1);
  await sleep(5000);
  if (!(await callApi('patch', `/quest-dao/${questKeyStr}/dao-success/set`, undefined, 'set-decision')).ok) process.exit(1);
  await callApi('patch', `/quest-dao/${questKeyStr}/sync?force=1`, undefined, 'sync-after-set-decision');
  await sleep(2000);

  console.log('\n[10] Answer voting (determine winning answer)');
  const answerVoterKeys = betterKeyFiles.map(readKeypairFromFile); // reuse same keypairs
  const preparedAnswerVoters = [];
  for (let i = 0; i < answerVoterKeys.length; i++) {
    const voter = answerVoterKeys[i];
    const nftAccount = await getNftAccountFromDb(voter.publicKey);
    await waitForAccount(connection, nftAccount, `voter${i + 1} NFT account`);
    await ensureCheckpoint(connection, gov, voter, nftAccount, i + 1);
    preparedAnswerVoters.push({ keypair: voter, nftAccount });
    console.log(`    voter${i + 1} NFT account: ${nftAccount.toBase58()}`);
  }

  const answerVotePlan = [
    { voter: preparedAnswerVoters[0], answerKey: answer1Key, label: 'voter1 -> answer1' },
    { voter: preparedAnswerVoters[1], answerKey: answer1Key, label: 'voter2 -> answer1' },
    { voter: preparedAnswerVoters[2], answerKey: answer2Key, label: 'voter3 -> answer2' },
  ];

  const answerVoteResults = [];
  for (const plan of answerVotePlan) {
    if (!plan.voter) continue;
    try {
      console.log(`    ${plan.label}`);
      const tx = await gov.voteAnswer(questKey, plan.answerKey, plan.voter.keypair.publicKey, plan.voter.nftAccount);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = plan.voter.keypair.publicKey;
      tx.recentBlockhash = blockhash;
      tx.partialSign(plan.voter.keypair);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'finalized');
      console.log('      vote tx:', sig);
      answerVoteResults.push({
        voter: plan.voter,
        answerKey: plan.answerKey,
        tx: sig,
      });
      await sleep(2000);
    } catch (e) {
      console.error(`      vote failed:`, e?.message || e);
      process.exit(1);
    }
  }

  console.log('  Syncing after answer votes...');
  await callApi('patch', `/quest-dao/${questKeyStr}/sync?force=1`, undefined, 'sync-after-answer-vote');
  await sleep(2000);

  console.log('\n[11] Set answer and finalize answer');
  const setAnswerRes = await callApi('patch', `/quest-dao/${questKeyStr}/answer`, undefined, 'set-answer');
  if (!setAnswerRes.ok) {
    console.error('  ❌ Set answer failed:', setAnswerRes.data);
    process.exit(1);
  }
  await sleep(2000);

  const finalizeAnswerRes = await callApi('patch', `/quest-dao/${questKeyStr}/finalize-answer`, undefined, 'finalize-answer');
  if (!finalizeAnswerRes.ok) {
    console.error('  ❌ Finalize answer failed:', finalizeAnswerRes.data);
    process.exit(1);
  }
  await sleep(3000);
  await callApi('patch', `/quest-dao/${questKeyStr}/sync?force=1`, undefined, 'sync-after-finalize-answer');
  await sleep(2000);

  console.log('\n[12] Claim betting rewards for winners');
  const winningAnswerKeyStr = answers[0].answer_key;
  for (const bet of betPlacements) {
    const betAnswerMatch = bet.answerKey.eq(answer1Key);
    if (!betAnswerMatch) {
      console.log(`  ${bet.label} bet on losing answer, skipping claim.`);
      continue;
    }
    try {
      const claimTx = await bpMarketSDK.receiveToken(questKey, bet.answerKey, bet.keypair.publicKey);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      claimTx.feePayer = bet.keypair.publicKey;
      claimTx.recentBlockhash = blockhash;
      claimTx.partialSign(bet.keypair);
      const sig = await connection.sendRawTransaction(claimTx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`  ${bet.label} claimed betting reward, tx:`, sig);
      await sleep(1500);
    } catch (e) {
      console.log(`  ${bet.label} claim failed:`, e?.message || e);
    }
  }

  console.log('\n[13] Claim vote rewards for voters who chose winning answer');
  let tokenMintForReward = bettingToken;
  try {
    const cfg = await gov.fetchConfig();
    tokenMintForReward = cfg.baseTokenMint ?? cfg.base_token_mint ?? cfg.baseToken ?? cfg.base_token ?? bettingToken;
  } catch (e) {
    console.warn('  Warn: could not fetch governance config for reward mint:', e?.message || e);
  }
  const [treasuryPda] = gov.getTreasuryPDA();
  for (const vote of answerVoteResults) {
    if (!vote.answerKey.eq(answer1Key)) continue;
    try {
      const voterPubkey = vote.voter.keypair.publicKey;
      const voterTokenAccount = (await getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        tokenMintForReward,
        voterPubkey,
        false,
        'confirmed',
      )).address;
      const rewardTx = await gov.distributeReward(
        questKey,
        voterPubkey,
        voterTokenAccount,
        treasuryPda,
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      rewardTx.feePayer = admin.publicKey;
      rewardTx.recentBlockhash = blockhash;
      rewardTx.sign(admin);
      const sig = await connection.sendRawTransaction(rewardTx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`  Vote reward claimed for ${voterPubkey.toBase58()}, tx:`, sig);
      await sleep(1500);
    } catch (e) {
      console.log('  Vote reward claim failed:', e?.message || e);
    }
  }

  console.log('\n✅ UI full flow completed successfully');
  console.log(`   Quest Key: ${questKeyStr}`);
  console.log('   - Draft + Decision + Answer phases completed');
  console.log('   - Bets placed and winning bets claimed');
  console.log('   - Vote rewards claimed for winning voters');
  console.log('   - Quest ready for final UI validations');
  process.exit(0);
})().catch((e) => {
  console.error('❌ Failed:', e?.message || e);
  if (e?.stack) console.error('Stack:', e.stack);
  process.exit(1);
});