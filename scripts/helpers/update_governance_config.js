try {
  const path = require('path');
  const fs = require('fs');
  const rootDir = path.resolve(__dirname, '../..');

  const envDevPath = path.resolve(rootDir, '.env.dev');
  if (fs.existsSync(envDevPath)) {
    require('dotenv').config({ path: envDevPath });
  }

  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  const envPath = path.resolve(rootDir, envName);
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }

  const envRootPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envRootPath)) {
    require('dotenv').config({ path: envRootPath });
  }

  require('dotenv').config();
} catch (err) {
  console.warn('Warning: Could not load .env files:', err.message);
}

const axios = require('axios');
const bs58 = require('bs58');
const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const { Keypair, Connection, Transaction } = require('@solana/web3.js');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
  const baseURL = arg('--baseURL', 'http://127.0.0.1:3000');
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';

  const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
  const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
  if (!adminWallet || !adminSkStr) { console.error('Missing admin env (SOLANA_MASTER_WALLET[_DEV], SOLANA_MASTER_WALLET_PRIVATE_KEY[_DEV])'); process.exit(1); }

  const token = jwt.sign({ wallet_address: adminWallet, role: 'ADMIN' }, process.env.JWT_SECRET || 'your_strong_secret_here');
  const baseHeaders = { authorization: `Bearer ${token}` };
  const buildAuthHeaders = (extraMessage) => {
    try {
      const ts = Math.floor(Date.now() / 1000);
      const message = `${adminWallet}-${ts}${extraMessage ? `-${extraMessage}` : ''}`;
      const kp = Keypair.fromSecretKey(adminSkStr.startsWith('[') ? Uint8Array.from(JSON.parse(adminSkStr)) : bs58.decode(adminSkStr));
      const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), kp.secretKey);
      return { 'x-auth-message': message, 'x-auth-signature': Buffer.from(sig).toString('base64') };
    } catch (_) { return {}; }
  };

  const callApi = async (method, url, data, note) => {
    const headers = { ...baseHeaders, ...buildAuthHeaders(note) };
    const u = `${baseURL}${url}`;
    try {
      const r = await axios({ method, url: u, data, headers });
      console.log(`[API OK] ${method.toUpperCase()} ${url}${note ? ` | ${note}` : ''}:`, r.status);
      return r.data?.data || r.data;
    } catch (e) {
      const st = e?.response?.status; const d = e?.response?.data;
      console.log(`[API NG] ${method.toUpperCase()} ${url}${note ? ` | ${note}` : ''}:`, st, typeof d === 'object' ? JSON.stringify(d) : d);
      throw e;
    }
  };

  const connection = new Connection(rpcUrl, 'confirmed');
  const admin = Keypair.fromSecretKey(adminSkStr.startsWith('[') ? Uint8Array.from(JSON.parse(adminSkStr)) : bs58.decode(adminSkStr));

  const submitTxIfAny = async (resp, label) => {
    const b64 = resp?.transaction || resp?.tx;
    if (!b64 || typeof b64 !== 'string') {
      console.warn(`[TX SKIP] ${label}: No transaction in response`);
      return null;
    }
    const raw = Buffer.from(b64, 'base64');
    let tx;
    try {
      tx = Transaction.from(raw);
    } catch (e) {
      console.error(`[TX ERROR] ${label}: Failed to parse transaction:`, e?.message || e);
      throw e;
    }
    try {
      tx.sign(admin);
      console.log(`[TX SIGN] ${label}: Transaction signed, sending to ${rpcUrl}...`);
      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });
      console.log(`[TX SUBMIT] ${label}: ${sig}`);
      console.log(`[TX WAIT] ${label}: Waiting for confirmation...`);
      const conf = await connection.confirmTransaction(sig, 'confirmed');
      if (conf?.value?.err) {
        console.error(`[TX FAILED] ${label}:`, JSON.stringify(conf.value.err));
        throw new Error(`Transaction failed: ${JSON.stringify(conf.value.err)}`);
      }
      console.log(`[TX CONFIRMED] ${label}: Success`);
      try {
        await callApi('post', '/vote/admin/submit-transaction-signature', { signature: sig, type: label }, `submit-sig:${label}`);
      } catch (_) { }
      return sig;
    } catch (e) {
      console.error(`[TX ERROR] ${label}:`, e?.message || e);
      if (e?.logs) {
        console.error(`[TX LOGS] ${label}:`, e.logs);
      }
      throw e;
    }
  };

  const minTotalVote = arg('--minTotalVote', undefined);
  const maxTotalVote = arg('--maxTotalVote', undefined);
  const minNfts = arg('--minNfts', undefined);
  const maxVotes = arg('--maxVotes', undefined);
  const durationHours = arg('--durationHours', undefined);
  const rewardAmount = arg('--rewardAmount', undefined);
  const pauseStr = arg('--pause', undefined); // 'true' | 'false'
  const baseNftCollection = arg('--baseNftCollection', undefined);

  console.log('Updating governance config at:', baseURL);

  let currentConfig = null;
  if (baseNftCollection !== undefined) {
    try {
      currentConfig = await callApi('get', '/vote/admin/fetch-config', undefined, 'fetch-config');
    } catch (e) {
      console.warn('Could not fetch current config (will continue anyway):', e.message);
    }
  }

  if (minTotalVote !== undefined || maxTotalVote !== undefined) {
    if (minTotalVote === undefined || maxTotalVote === undefined) {
      console.warn('skip set-total-vote: both --minTotalVote and --maxTotalVote are required to update');
    } else {
      const resp = await callApi('post', '/vote/admin/set-total-vote', {
        minTotalVote: Number(minTotalVote),
        maxTotalVote: Number(maxTotalVote),
        authority: adminWallet,
      }, 'set-total-vote');
      await submitTxIfAny(resp, 'set-total-vote');
    }
  }

  if (minNfts !== undefined) {
    const resp = await callApi('post', '/vote/admin/set-minimum-nfts', {
      minNfts: Number(minNfts),
      authority: adminWallet,
    }, 'set-minimum-nfts');
    await submitTxIfAny(resp, 'set-minimum-nfts');
  }

  if (maxVotes !== undefined) {
    const resp = await callApi('post', '/vote/admin/set-max-votes-per-voter', {
      maxVotes: Number(maxVotes),
      authority: adminWallet,
    }, 'set-max-votes-per-voter');
    await submitTxIfAny(resp, 'set-max-votes-per-voter');
  }

  if (durationHours !== undefined) {
    const resp = await callApi('post', '/vote/admin/set-quest-duration-hours', {
      durationHours: Number(durationHours),
      authority: adminWallet,
    }, 'set-quest-duration-hours');
    await submitTxIfAny(resp, 'set-quest-duration-hours');
  }

  if (rewardAmount !== undefined) {
    const resp = await callApi('post', '/vote/admin/set-reward-amount', {
      rewardAmount: Number(rewardAmount),
      authority: adminWallet,
    }, 'set-reward-amount');
    await submitTxIfAny(resp, 'set-reward-amount');
  }

  if (pauseStr !== undefined) {
    const pause = String(pauseStr).toLowerCase() === 'true';
    const resp = await callApi('post', '/vote/admin/pause-governance', {
      pause,
      authority: adminWallet,
    }, 'pause-governance');
    await submitTxIfAny(resp, 'pause-governance');
  }

  if (baseNftCollection !== undefined) {
    if (!baseNftCollection || baseNftCollection.length < 32) {
      console.error('Invalid baseNftCollection address format');
      process.exit(1);
    }

    console.log('Updating baseNftCollection:');
    if (currentConfig) {
      const current = currentConfig?.baseNftCollection?.toBase58?.() || currentConfig?.baseNftCollection;
      console.log('  Current:', current || '(not set)');
    } else {
      console.log('  Current: (could not fetch)');
    }
    console.log('  New:    ', baseNftCollection);

    const resp = await callApi('post', '/vote/admin/set-base-nft-collection', {
      baseNftCollection: baseNftCollection,
      authority: adminWallet,
    }, 'set-base-nft-collection');
    await submitTxIfAny(resp, 'set-base-nft-collection');
  }

  const cfg = await callApi('get', '/vote/admin/fetch-config', undefined, 'fetch-config');
  console.log('✓ Updated Governance Config:', JSON.stringify(cfg, null, 2));

  const numishToNumber = (v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (/^[0-9]+$/.test(s)) {
        const n = Number(s);
        return Number.isNaN(n) ? undefined : n;
      }
      if (/^[0-9a-f]+$/.test(s)) {
        const n = parseInt(s, 16);
        return Number.isNaN(n) ? undefined : n;
      }
      const n = Number(s);
      return Number.isNaN(n) ? undefined : n;
    }
    if (typeof v === 'bigint') return Number(v);
    if (typeof v?.toString === 'function') {
      const n = Number(v.toString());
      return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
  };

  const actual = {
    minTotalVote: numishToNumber(cfg?.minTotalVote ?? cfg?.min_total_vote),
    maxTotalVote: numishToNumber(cfg?.maxTotalVote ?? cfg?.max_total_vote),
    minNfts: numishToNumber(cfg?.minRequiredNft ?? cfg?.minimumRequiredNfts ?? cfg?.min_required_nft),
    maxVotes: numishToNumber(cfg?.maxVotesPerVoter ?? cfg?.max_votes_per_voter),
    durationHours: numishToNumber(cfg?.questDurationHours ?? cfg?.durationHours ?? cfg?.quest_duration_hours),
    rewardAmount: (() => {
      const lamports = numishToNumber(cfg?.rewardAmount ?? cfg?.constantRewardToken ?? cfg?.reward_amount);
      return lamports !== undefined ? lamports / 1e9 : undefined;
    })(),
    pause: !!(cfg?.paused ?? cfg?.pause),
  };

  const expected = {
    minTotalVote: minTotalVote !== undefined ? Number(minTotalVote) : undefined,
    maxTotalVote: maxTotalVote !== undefined ? Number(maxTotalVote) : undefined,
    minNfts: minNfts !== undefined ? Number(minNfts) : undefined,
    maxVotes: maxVotes !== undefined ? Number(maxVotes) : undefined,
    durationHours: durationHours !== undefined ? Number(durationHours) : undefined,
    rewardAmount: rewardAmount !== undefined ? Number(rewardAmount) : undefined,
    pause: pauseStr !== undefined ? (String(pauseStr).toLowerCase() === 'true') : undefined,
    baseNftCollection: baseNftCollection !== undefined ? baseNftCollection : undefined,
  };

  const actualBaseNftCollection = cfg?.baseNftCollection?.toBase58?.() || cfg?.baseNftCollection;
  if (actualBaseNftCollection) {
    actual.baseNftCollection = actualBaseNftCollection;
  }

  const checks = [];
  for (const key of Object.keys(expected)) {
    if (expected[key] !== undefined) {
      const a = actual[key];
      if (a === undefined) {
        checks.push({ key, ok: null, expected: expected[key], actual: a, note: 'not-returned-in-fetch-config' });
      } else {
        const ok = key === 'baseNftCollection'
          ? String(a) === String(expected[key])
          : a === expected[key];
        checks.push({ key, ok, expected: expected[key], actual: a });
      }
    }
  }

  if (checks.length) {
    const failed = checks.filter(c => c.ok === false);
    const unknown = checks.filter(c => c.ok === null);
    console.log('Verification results:');
    checks.forEach(c => {
      if (c.ok === null) {
        console.log(`  ${c.key}: SKIP (not present in fetch-config) (expected=${c.expected}, actual=${c.actual})`);
      } else {
        const icon = c.ok ? '✓' : '✗';
        console.log(`  ${icon} ${c.key}: ${c.ok ? 'OK' : 'MISMATCH'} (expected=${c.expected}, actual=${c.actual})`);
      }
    });
    if (failed.length) {
      console.error(`✗ Verification failed for ${failed.length} field(s).`);
      process.exit(2);
    } else if (unknown.length) {
      console.warn(`Verification skipped for ${unknown.length} field(s) as they are not returned by fetch-config.`);
    } else {
      console.log('✓ All verifications passed!');
    }
  }

  process.exit(0);
})().catch(e => { console.error('✗ Update config failed:', e.message); process.exit(1); });


