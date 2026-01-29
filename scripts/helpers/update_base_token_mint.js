// Update base token mint in Governance config
try {
    const path = require('path');
    const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

const axios = require('axios');
const bs58 = require('bs58');
const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
    const baseURL = arg('--baseURL', 'http://127.0.0.1:3000');
    const newToken = arg('--newToken', 'GVi8Ce9QdL18QrD4WBjJznxtaoQefxJT5bNqUodTcZ7R');
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';

    const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
    const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
    if (!adminWallet || !adminSkStr) {
        console.error('Missing admin env (SOLANA_MASTER_WALLET[_DEV], SOLANA_MASTER_WALLET_PRIVATE_KEY[_DEV])');
        process.exit(1);
    }

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
            return sig;
        } catch (e) {
            console.error(`[TX ERROR] ${label}:`, e?.message || e);
            if (e?.logs) {
                console.error(`[TX LOGS] ${label}:`, e.logs);
            }
            throw e;
        }
    };

    console.log('========================================');
    console.log('Update Base Token Mint');
    console.log('========================================\n');
    console.log('Current config:');

    const currentConfig = await callApi('get', '/vote/admin/fetch-config', undefined, 'fetch-config');
    console.log('  Base Token Mint:', currentConfig.baseTokenMint);
    console.log('\nNew token mint:', newToken);
    console.log();

    if (currentConfig.baseTokenMint === newToken) {
        console.log('✓ Base token mint is already set to the new token');
        process.exit(0);
    }

    console.log('Updating base token mint...\n');

    const resp = await callApi('post', '/vote/admin/update-base-token-mint', {
        newBaseTokenMint: newToken,
        authority: adminWallet,
    }, 'update-base-token-mint');

    const sig = await submitTxIfAny(resp, 'update-base-token-mint');

    console.log('\nVerifying update...');
    const updatedConfig = await callApi('get', '/vote/admin/fetch-config', undefined, 'fetch-config');

    console.log('\n✓ Updated Governance Config:');
    console.log('  Base Token Mint:', updatedConfig.baseTokenMint);

    if (updatedConfig.baseTokenMint === newToken) {
        console.log('\n✅ Base token mint successfully updated!');
        console.log('Transaction:', sig);
    } else {
        console.error('\n❌ Base token mint update failed - value not changed');
        process.exit(1);
    }

    console.log('\n========================================');
    console.log('Update Complete');
    console.log('========================================');
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('1. Fund the new treasury token account with the custom token');
    console.log('2. Handle any pending WSOL rewards from the old treasury');
    console.log('3. Test reward distribution with the new token');
    console.log();

    process.exit(0);
})().catch(e => { console.error('✗ Update failed:', e.message); process.exit(1); });
