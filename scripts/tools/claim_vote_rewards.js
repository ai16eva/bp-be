
try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const models = require('../../src/models/mysql');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const gov = new GovernanceSDK(connection);

  const questKeyStr = arg('--questKey');
  const claimAll = process.argv.includes('--all');
  const useKeys = process.argv.includes('--useKeys');


  if (!questKeyStr && !claimAll) {
    console.error('Usage: node claim_vote_rewards.js --questKey <quest_key> | --all [--useKeys]');
    process.exit(1);
  }

  let keyVoters = [];
  let keyVoterKeypairs = new Map();
  if (useKeys) {
    const keysDir = path.resolve(__dirname, '../keys');
    const keyFiles = [
      path.join(keysDir, 'voter1.json'),
      path.join(keysDir, 'voter2.json'),
      path.join(keysDir, 'voter3.json'),
    ];

    for (const keyFile of keyFiles) {
      if (fs.existsSync(keyFile)) {
        try {
          const raw = fs.readFileSync(keyFile, 'utf8');
          const arr = JSON.parse(raw);
          const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
          const voterAddress = kp.publicKey.toBase58();
          keyVoters.push(voterAddress);
          keyVoterKeypairs.set(voterAddress, kp);
        } catch (e) {
        }
      }
    }
  }

  const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
  const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
  if (!adminWallet || !adminSkStr) {
    console.error('Missing admin env (SOLANA_MASTER_WALLET[_DEV], SOLANA_MASTER_WALLET_PRIVATE_KEY[_DEV])');
    process.exit(1);
  }

  let adminSecretKey;
  try {
    const trimmed = adminSkStr.trim();
    if (trimmed.startsWith('[')) {
      adminSecretKey = Uint8Array.from(JSON.parse(trimmed));
    } else {
      adminSecretKey = bs58.decode(trimmed);
    }
  } catch (e) {
    console.error('Failed to parse admin private key:', e?.message || e);
    process.exit(1);
  }
  const admin = Keypair.fromSecretKey(adminSecretKey);

  const config = await gov.fetchConfig();
  const tokenMint = config.baseTokenMint || config.base_token_mint || new PublicKey('So11111111111111111111111111111111111111112');

  let questsToProcess = [];
  if (claimAll) {
    const allQuests = await models.quests.findAll({
      where: {
        quest_status: 'DAO_SUCCESS',
      },
      attributes: ['quest_key'],
    });

    for (const quest of allQuests) {
      try {
        const questKey = new BN(String(quest.quest_key));
        const [answerVotePDA] = gov.getAnswerVotePDA(questKey);
        const answerVote = await gov.program.account.answerVote.fetch(answerVotePDA);
        if (answerVote?.finalized) {
          questsToProcess.push(quest.quest_key);
        }
      } catch (e) {
      }
    }
  } else {
    questsToProcess = [questKeyStr];
  }

  if (questsToProcess.length === 0) {
    console.log('No quests to process');
    process.exit(0);
  }

  for (const questKeyStr of questsToProcess) {
    const questKey = new BN(String(questKeyStr));

    try {
      const [answerVotePDA] = gov.getAnswerVotePDA(questKey);
      let answerVote;
      try {
        answerVote = await gov.program.account.answerVote.fetch(answerVotePDA);
      } catch (e1) {
        try {
          answerVote = await gov.program.account.AnswerVote.fetch(answerVotePDA);
        } catch (e2) {
          continue;
        }
      }

      if (!answerVote?.finalized) {
        continue;
      }

      const winningAnswerKey = answerVote.winningAnswer?.toString() || answerVote.winning_answer?.toString();
      if (!winningAnswerKey || winningAnswerKey === '0') {
        continue;
      }

      const questKeyLE = questKey.toArrayLike(Buffer, 'le', 8);
      const memcmp = { offset: 8, bytes: bs58.encode(questKeyLE) };

      let answerVoterAccounts = [];
      try {
        answerVoterAccounts = await gov.program.account.answerVoterRecord.all([{ memcmp }]);
      } catch (e1) {
        try {
          answerVoterAccounts = await gov.program.account.AnswerVoterRecord.all([{ memcmp }]);
        } catch (e2) {
          console.error(`  ❌ Failed to fetch answer voter records: ${e1.message}, ${e2.message}`);
          continue;
        }
      }

      const eligibleVoters = [];
      for (const acc of answerVoterAccounts) {
        const accountData = acc.account || acc;
        const voterAnswerKey = accountData.answerKey?.toString() || accountData.answer_key?.toString();
        const voterAddress = accountData.voter?.toBase58?.() || accountData.voter;
        const rewarded = accountData.rewarded || false;

        if (useKeys && !keyVoters.includes(voterAddress)) {
          continue;
        }

        if (voterAnswerKey === winningAnswerKey && !rewarded) {
          eligibleVoters.push({
            voter: voterAddress,
            answerKey: voterAnswerKey,
            voteCount: accountData.voteCount?.toString() || accountData.vote_count?.toString() || '0',
          });
        }
      }

      if (eligibleVoters.length === 0) {
        continue;
      }

      for (const { voter: voterAddress } of eligibleVoters) {
        try {
          const voterPubkey = new PublicKey(voterAddress);

          const voterTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
            connection,
            admin,
            tokenMint,
            voterPubkey,
            false,
            'confirmed'
          );
          const voterTokenAccount = voterTokenAccountInfo.address;

          const [treasuryPda] = gov.getTreasuryPDA();

          const tx = await gov.distributeReward(
            questKey,
            voterPubkey,
            voterTokenAccount,
            treasuryPda,
          );

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          tx.feePayer = admin.publicKey;
          tx.recentBlockhash = blockhash;
          tx.sign(admin);

          const voterKeypair = keyVoterKeypairs.get(voterAddress);
          if (voterKeypair) {
            tx.partialSign(voterKeypair);
          }

          const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });

          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            'confirmed'
          );

          await sleep(2000);
        } catch (e) {
          console.error(`Failed to claim reward for ${voterAddress}:`, e?.message || e);
        }
      }
    } catch (e) {
      console.error(`  ❌ Error processing quest ${questKeyStr}:`, e?.message || e);
    }
  }

  process.exit(0);
})().catch(e => {
  console.error('❌ Unhandled error:', e?.message || e);
  if (e?.stack) console.error('Stack:', e.stack);
  process.exit(1);
});

