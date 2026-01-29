const axios = require('axios');
const jwt = require('jsonwebtoken');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

function buildAuthHeaders(adminWallet, adminSk, extraMessage) {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const message = `${adminWallet}-${ts}${extraMessage ? `-${extraMessage}` : ''}`;

    let secretKey;
    if (adminSk instanceof Keypair) {
      secretKey = adminSk.secretKey;
    } else if (typeof adminSk === 'string') {
      secretKey = adminSk.startsWith('[')
        ? Uint8Array.from(JSON.parse(adminSk))
        : bs58.decode(adminSk);
    } else {
      secretKey = adminSk;
    }

    const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), secretKey);
    return { 'x-auth-message': message, 'x-auth-signature': Buffer.from(sig).toString('base64') };
  } catch (error) {
    console.warn('Failed to build auth headers:', error.message);
    return {};
  }
}

async function callApi(baseURL, headers, buildAuthFn, method, url, data, note) {
  try {
    const authHeaders = buildAuthFn ? buildAuthFn(note) : {};
    const r = await axios({
      method,
      url: `${baseURL}${url}`,
      data,
      headers: { ...headers, ...authHeaders },
      timeout: 60000
    });
    console.log(`  ✓ [API OK] ${method.toUpperCase()} ${url}${note ? ` | ${note}` : ''}:`, r.status);
    return { ok: true, status: r.status, data: r.data };
  } catch (e) {
    const st = e?.response?.status;
    const d = e?.response?.data;
    const errorMsg = e?.message || 'Unknown error';
    console.log(` ✗ [API NG] ${method.toUpperCase()} ${url}${note ? ` | ${note}` : ''}:`, st || 'No status', d ? (typeof d === 'object' ? JSON.stringify(d) : d) : errorMsg);

    if (e?.code === 'ECONNREFUSED') {
      console.error('   ✗ Server không chạy hoặc không thể kết nối!');
      process.exit(1);
    }

    return { ok: false, status: st, data: d || { error: errorMsg } };
  }
}

async function sendSol(connection, fromKeypair, toPubkey, lamports) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPubkey,
      lamports
    })
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = fromKeypair.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(fromKeypair);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 2
  });
  await connection.confirmTransaction({
    signature: sig,
    blockhash,
    lastValidBlockHeight
  }, 'confirmed');
  return sig;
}

async function setupVoters(connection, gov, admin, authority, count = 2, minSol = 2e8) {
  const voters = [];

  for (let i = 0; i < count; i++) {
    const voter = Keypair.generate();

    const balance = await connection.getBalance(voter.publicKey, { commitment: 'confirmed' });
    if (balance < minSol) {
      await sendSol(connection, admin, voter.publicKey, minSol);
      await new Promise(r => setTimeout(r, 1000));
    }

    const mintResult = await gov.mintGovernanceNft(
      `Voter${i + 1}`,
      `V${i + 1}`,
      `https://example.com/v${i + 1}`,
      voter.publicKey
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    mintResult.transaction.feePayer = admin.publicKey;
    mintResult.transaction.recentBlockhash = blockhash;
    mintResult.transaction.partialSign(admin, mintResult.nftMint, voter);
    const mintSig = await connection.sendRawTransaction(
      mintResult.transaction.serialize(),
      { skipPreflight: true, maxRetries: 2 }
    );
    await connection.confirmTransaction(mintSig, 'confirmed');

    await new Promise(r => setTimeout(r, 1000));

    const nftAccount = await getAssociatedTokenAddress(
      mintResult.nftMint.publicKey,
      voter.publicKey
    );

    const txChk = await gov.updateVoterCheckpoint(voter.publicKey, [nftAccount]);
    const { blockhash: chkBlockhash } = await connection.getLatestBlockhash('confirmed');
    txChk.feePayer = voter.publicKey;
    txChk.recentBlockhash = chkBlockhash;
    txChk.sign(voter);
    const chkSig = await connection.sendRawTransaction(
      txChk.serialize(),
      { skipPreflight: true, maxRetries: 2 }
    );
    await connection.confirmTransaction(chkSig, 'finalized');

    voters.push({
      keypair: voter,
      nftMint: mintResult.nftMint.publicKey,
      nftAccount: nftAccount,
      checkpoint: gov.getVoterCheckpointsPDA(voter.publicKey)[0]
    });

    await new Promise(r => setTimeout(r, 1000));
  }

  return voters;
}

function initTestEnv() {
  function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
  }

  const baseURL = arg('--baseURL', 'http://127.0.0.1:3000');
  const auto = process.argv.includes('--auto');
  let questKeyStr = arg('--questKey');
  if (!questKeyStr && auto) questKeyStr = String(Math.floor(Date.now() / 1000));

  const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
  const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
  const jwtSecret = process.env.JWT_SECRET || 'your_strong_secret_here';

  if (!adminWallet || !adminSkStr) {
    throw new Error('Missing admin env vars (SOLANA_MASTER_WALLET_DEV, SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV)');
  }

  const admin = Keypair.fromSecretKey(
    adminSkStr.startsWith('[')
      ? Uint8Array.from(JSON.parse(adminSkStr))
      : bs58.decode(adminSkStr)
  );

  const token = jwt.sign(
    { wallet_address: adminWallet, role: 'ADMIN' },
    jwtSecret
  );

  const baseHeaders = {
    authorization: `Bearer ${token}`,
    'x-admin-sk-b58': adminSkStr
  };

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV,
    'confirmed'
  );

  const gov = new GovernanceSDK(connection);
  const authority = new PublicKey(adminWallet);

  const buildAuthFn = (extraMessage) => buildAuthHeaders(adminWallet, admin.secretKey, extraMessage);

  const callApiFn = (method, url, data, note) => callApi(baseURL, baseHeaders, buildAuthFn, method, url, data, note);

  return {
    baseURL,
    questKeyStr,
    adminWallet,
    admin,
    adminSkStr,
    token,
    baseHeaders,
    connection,
    gov,
    authority,
    buildAuthHeaders: buildAuthFn,
    callApi: callApiFn
  };
}

module.exports = {
  buildAuthHeaders,
  callApi,
  sendSol,
  setupVoters,
  initTestEnv
};

