try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) {}

const { BN } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');
const { Keypair, PublicKey } = require('@solana/web3.js');
const models = require('../../src/models/mysql');
const { initTestEnv, sendSol } = require('../helpers/testHelpers');

(async () => {
  const env = initTestEnv();
  const { connection, gov, admin, authority, callApi } = env;

  function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
  }

  const questKeyStr = arg('--questKey');
  if (!questKeyStr) {
    console.error('Missing --questKey <number>');
    process.exit(1);
  }

  const questKey = new BN(String(questKeyStr));
  console.log('vote_three_times');
  console.log(`QuestKey: ${questKeyStr}`);

  // Ensure governance config exists and meets minimums (idempotent)
  try {
    const cfg = await gov.fetchConfig();
    const minNft = cfg?.minRequiredNft ?? cfg?.min_required_nft;
    const minVote = cfg?.minTotalVote?.toNumber?.() ?? cfg?.min_total_vote ?? 0;
    const maxVote = cfg?.maxTotalVote?.toNumber?.() ?? cfg?.max_total_vote ?? 0;
    const baseNftCollection = cfg?.baseNftCollection ?? cfg?.base_nft_collection;
    const [collectionMintPDA] = gov.getCollectionMintPDA();
    console.log('  Config snapshot:', { minNft, minVote, maxVote });
    console.log('  Config baseNftCollection:', baseNftCollection?.toBase58?.() || baseNftCollection || 'null');
    console.log('  Collection Mint PDA:', collectionMintPDA.toBase58());

    // Set min NFTs if missing or zero
    if (!minNft || Number(minNft) < 1) {
      console.log('  ⚙️  Setting min required NFTs to 1 ...');
      const tx = await gov.setMinimumNfts(1, authority);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.sign(admin);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log('     setMinimumNfts tx:', sig);
    }

    // Set total votes if missing or invalid
    if (!minVote || !maxVote || Number(minVote) < 1 || Number(maxVote) < Number(minVote)) {
      console.log('  ⚙️  Setting total vote range to [2,10] ...');
      const tx = await gov.setTotalVote(new BN(2), new BN(10), authority);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.sign(admin);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log('     setTotalVote tx:', sig);
    }
  } catch (cfgErr) {
    console.warn('  Governance config ensure warn:', cfgErr?.message || cfgErr);
  }

  try {
    console.log('  🔍 Verifying governanceItem/questVote PDAs...');
    // Best-effort wait for PDAs to be ready
    for (let i = 0; i < 5; i++) {
      try {
        const item = await gov.fetchGovernanceItem(questKey);
        const qv = await gov.fetchQuestVote(questKey);
        if (item && (item.questKey || item.quest_key) && qv) {
          console.log('   governanceItem and questVote are ready');
          break;
        }
      } catch (_) {}
      if (i < 4) await new Promise(r => setTimeout(r, 1500));
    }
  } catch (_) {}

  console.log('  Preparing 3 voters with NFTs and checkpoints (from DB)...');

  const envVoters = [
    process.env.SOLANA_VOTER1_SK,
    process.env.SOLANA_VOTER2_SK,
    process.env.SOLANA_VOTER3_SK,
  ].filter(Boolean);

  let voters;
  const keysDir = path.resolve(__dirname, '../keys');
  const keyFiles = [
    path.join(keysDir, 'voter1.json'),
    path.join(keysDir, 'voter2.json'),
    path.join(keysDir, 'voter3.json'),
  ];

  function ensureKeypairFiles() {
    if (!fs.existsSync(keysDir)) {
      throw new Error(`Missing voters key directory: ${keysDir}`);
    }
    for (const filePath of keyFiles) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing voter key file: ${path.basename(filePath)}. Provide voter keypairs with governance NFTs indexed in DB.`);
      }
    }
  }

  function readKeypairFromFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const arr = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  async function getNftAccountFromDb(publicKey) {
    const wallet = publicKey.toBase58();
    const record = await models.governance_nft_owners.findOne({
      where: { owner_wallet: wallet },
      order: [['updated_at', 'DESC']],
    });
    if (!record || !record.token_account) {
      throw new Error(`No governance NFT token account found in DB for wallet ${wallet}. Run scripts/index_with_helius_das.js.`);
    }
    return new PublicKey(record.token_account);
  }

  async function waitForTokenAccount(tokenAccount) {
    for (let i = 0; i < 10; i++) {
      const info = await connection.getAccountInfo(tokenAccount, 'confirmed');
      if (info) return;
      if (i < 9) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error(`Token account ${tokenAccount.toBase58()} not found on-chain`);
  }

  async function ensureCheckpointForVoter(keypair, nftAccount, indexLabel) {
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

    if (hasCheckpoint) {
      console.log(`   [checkpoint] voter${indexLabel} already registered`);
      return;
    }

    const txChk = await gov.updateVoterCheckpoint(keypair.publicKey, [nftAccount]);
    const { blockhash: chkBh, lastValidBlockHeight: chkLvh } = await connection.getLatestBlockhash('confirmed');
    txChk.feePayer = keypair.publicKey;
    txChk.recentBlockhash = chkBh;
    txChk.partialSign(keypair);
    const chkSig = await connection.sendRawTransaction(txChk.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: chkSig, blockhash: chkBh, lastValidBlockHeight: chkLvh }, 'finalized');
    console.log(`   [checkpoint] voter${indexLabel} sig:`, chkSig);
    await new Promise(r => setTimeout(r, 1000));
  }

  async function prepareVotersFromKeypairs(voterKeypairs) {
    const prepared = [];
    for (let i = 0; i < voterKeypairs.length; i++) {
      const voter = voterKeypairs[i];
      const bal = await connection.getBalance(voter.publicKey, { commitment: 'confirmed' });
      if (bal < 2e8) {
        await sendSol(connection, admin, voter.publicKey, 3e9);
        await new Promise(r => setTimeout(r, 800));
      }

      const nftAccount = await getNftAccountFromDb(voter.publicKey);
      await waitForTokenAccount(nftAccount);
      await ensureCheckpointForVoter(voter, nftAccount, i + 1);
      console.log(`   voter${i + 1} NFT account:`, nftAccount.toBase58());

      prepared.push({
        keypair: voter,
        nftAccount,
      });
    }
    return prepared;
  }

  let voterKeypairs;
  if (envVoters.length === 3) {
    console.log('   Using persistent voters from env (SOLANA_VOTER{1,2,3}_SK)');
    voterKeypairs = envVoters.map(skStr =>
      Keypair.fromSecretKey(
        skStr.startsWith('[')
          ? Uint8Array.from(JSON.parse(skStr))
          : bs58.decode(skStr)
      )
    );
  } else {
    ensureKeypairFiles();
    voterKeypairs = keyFiles.map(readKeypairFromFile);
  }

  voters = await prepareVotersFromKeypairs(voterKeypairs);

  if (!Array.isArray(voters) || voters.length < 3) {
    console.error('Failed to prepare 3 voters');
    process.exit(1);
  }

  console.log('  🔍 Verifying questVote PDA exists...');
  let questVoteReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      const questVote = await gov.fetchQuestVote(questKey);
      if (questVote) {
        questVoteReady = true;
        console.log('   QuestVote PDA is ready');
        break;
      }
    } catch (e) {
      if (i === 9) {
        console.error('   QuestVote PDA not found after 10 attempts:', e.message);
        throw new Error('QuestVote PDA not initialized');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!questVoteReady) {
    throw new Error('QuestVote PDA is not ready');
  }

  console.log('  Casting votes: APPROVE, APPROVE, REJECT');
  try {
    console.log('     Voter 1 voting APPROVE...');
    let vote1Tx = await gov.voteQuest(questKey, 1, voters[0].keypair.publicKey, voters[0].nftAccount);
    const { blockhash: bh1, lastValidBlockHeight: lvh1 } = await connection.getLatestBlockhash('confirmed');
    vote1Tx.feePayer = voters[0].keypair.publicKey;
    vote1Tx.recentBlockhash = bh1;
    vote1Tx.partialSign(voters[0].keypair);
    let sig1 = await connection.sendRawTransaction(vote1Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: sig1, blockhash: bh1, lastValidBlockHeight: lvh1 }, 'finalized');
    console.log('     Voter 1 voted APPROVE, tx:', sig1);
    await new Promise(r => setTimeout(r, 3000));

    console.log('     Voter 2 voting APPROVE...');
    let vote2Tx = await gov.voteQuest(questKey, 1, voters[1].keypair.publicKey, voters[1].nftAccount);
    const { blockhash: bh2, lastValidBlockHeight: lvh2 } = await connection.getLatestBlockhash('confirmed');
    vote2Tx.feePayer = voters[1].keypair.publicKey;
    vote2Tx.recentBlockhash = bh2;
    vote2Tx.partialSign(voters[1].keypair);
    let sig2 = await connection.sendRawTransaction(vote2Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction({ signature: sig2, blockhash: bh2, lastValidBlockHeight: lvh2 }, 'finalized');
    console.log('     Voter 2 voted APPROVE, tx:', sig2);
    await new Promise(r => setTimeout(r, 3000));

    if (voters.length >= 3) {
      console.log('     Voter 3 voting REJECT...');
      let vote3Tx = await gov.voteQuest(questKey, 0, voters[2].keypair.publicKey, voters[2].nftAccount);
      const { blockhash: bh3, lastValidBlockHeight: lvh3 } = await connection.getLatestBlockhash('confirmed');
      vote3Tx.feePayer = voters[2].keypair.publicKey;
      vote3Tx.recentBlockhash = bh3;
      vote3Tx.partialSign(voters[2].keypair);
      let sig3 = await connection.sendRawTransaction(vote3Tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      await connection.confirmTransaction({ signature: sig3, blockhash: bh3, lastValidBlockHeight: lvh3 }, 'finalized');
      console.log('     Voter 3 voted REJECT, tx:', sig3);
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log('  Waiting for PDA sync...');
    await new Promise(r => setTimeout(r, 6000));
    console.log('   Draft phase voting complete - 2 approve, 1 reject');
  } catch (e) {
    console.error('   Vote quest failed:', e?.message || JSON.stringify(e, null, 2) || String(e));
    if (e?.logs) console.error('  Transaction logs:', e.logs);
    process.exit(1);
  }

  console.log('  Verifying on-chain counts...');
  try {
    const qv = await gov.fetchQuestVote(questKey);
    const approve = qv?.countApprover?.toNumber?.() || qv?.count_approver || 0;
    const reject = qv?.countRejector?.toNumber?.() || qv?.count_rejector || 0;
    const total = qv?.totalVoted?.toNumber?.() || qv?.total_voted || 0;
    console.log(`   Approve=${approve}, Reject=${reject}, Total=${total}`);
    // Store for later comparison
    var onChainApprove = approve;
    var onChainReject = reject;
    var onChainTotal = total;
  } catch (e) {
    console.warn('   Could not fetch questVote:', e?.message || String(e));
  }

  // Sync DB with on-chain after draft voting
  try {
    await callApi('patch', `/quest-dao/${questKeyStr}/sync`, undefined, 'sync-after-draft-vote');
    await new Promise(r => setTimeout(r, 1500));
    console.log('  DB sync triggered after draft vote');
  } catch (e) {
    console.warn('  Failed to sync DB after draft vote:', e?.message || e);
  }

  // Verify DB matches on-chain after sync
  try {
    const models = require('../../src/models/mysql');
    const Vote = models.votes;
    const dbVotes = await Vote.findAll({
      where: { quest_key: questKeyStr },
      attributes: ['vote_power', 'vote_draft_option'],
    });

    const sum = (arr, pred) => arr.reduce((acc, v) => acc + (pred(v) ? (parseInt(v.vote_power) || 0) : 0), 0);
    const dbApprove = sum(dbVotes, v => v.vote_draft_option === 'APPROVE');
    const dbReject = sum(dbVotes, v => v.vote_draft_option === 'REJECT');
    const dbTotal = dbApprove + dbReject;

    console.log('  DB counts after sync:');
    console.log(`   Approve=${dbApprove}, Reject=${dbReject}, Total=${dbTotal}`);

    if (typeof onChainApprove === 'number') {
      const ok = onChainApprove === dbApprove && onChainReject === dbReject && onChainTotal === dbTotal;
      console.log(`  Compare on-chain vs DB: ${ok ? 'MATCH ✅' : 'MISMATCH ❌'}`);
      if (!ok) {
        console.warn(`   On-chain A/R/T = ${onChainApprove}/${onChainReject}/${onChainTotal}`);
        console.warn(`   In-DB    A/R/T = ${dbApprove}/${dbReject}/${dbTotal}`);
      }
    }
  } catch (verifyDbErr) {
    console.warn('  Failed to verify DB after sync:', verifyDbErr?.message || verifyDbErr);
  }

  console.log('Done. You can now Force End on UI and Set Draft Result.');
  process.exit(0);
})().catch(e => {
  console.error('Unhandled error:', e.message);
  process.exit(1);
});

