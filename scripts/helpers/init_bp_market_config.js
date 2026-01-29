
try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const { BPMarketSDK } = require('../../src/solana-sdk/dist/BPMarket');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
  try {
    const rpc = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
    const ownerStr = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
    const baseTokenStr = arg('--baseToken', process.env.BASE_TOKEN_MINT);

    // Fee account addresses - required for initialization
    const cojamFeeStr = arg('--cojamFee', process.env.SOLANA_COJAM_FEE_ACCOUNT);
    const charityFeeStr = arg('--charityFee', process.env.SOLANA_CHARITY_FEE_ACCOUNT);
    const remainStr = arg('--remain', process.env.SOLANA_REMAIN_ACCOUNT);

    if (!ownerStr) throw new Error('Missing SOLANA_MASTER_WALLET_DEV');
    if (!cojamFeeStr) throw new Error('Missing SOLANA_COJAM_FEE_ACCOUNT or --cojamFee argument');
    if (!charityFeeStr) throw new Error('Missing SOLANA_CHARITY_FEE_ACCOUNT or --charityFee argument');
    if (!remainStr) throw new Error('Missing SOLANA_REMAIN_ACCOUNT or --remain argument');

    const connection = new Connection(rpc, 'confirmed');
    const sdk = new BPMarketSDK(connection);

    try {
      const cfg = await sdk.fetchConfig();
      console.log('✓ BPMarket config already exists. Owner:', cfg.owner.toBase58());
      console.log('  Cojam Fee Account:', cfg.cojamFeeAccount.toBase58());
      console.log('  Charity Fee Account:', cfg.charityFeeAccount.toBase58());
      console.log('  Remain Account:', cfg.remainAccount.toBase58());
      return;
    } catch (_) { }

    const baseToken = new PublicKey(baseTokenStr);
    const owner = new PublicKey(ownerStr);
    const cojamFeeAccount = new PublicKey(cojamFeeStr);
    const charityFeeAccount = new PublicKey(charityFeeStr);
    const remainAccount = new PublicKey(remainStr);

    console.log('Initializing BPMarket config with:');
    console.log('  Owner:', owner.toBase58());
    console.log('  Base Token:', baseToken.toBase58());
    console.log('  Cojam Fee Account:', cojamFeeAccount.toBase58());
    console.log('  Charity Fee Account:', charityFeeAccount.toBase58());
    console.log('  Remain Account:', remainAccount.toBase58());

    const tx = await sdk.initialize(baseToken, owner, cojamFeeAccount, charityFeeAccount, remainAccount);

    const pkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
    if (!pkStr) throw new Error('Missing SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV');
    const secret = pkStr.startsWith('[') ? Uint8Array.from(JSON.parse(pkStr)) : bs58.decode(pkStr);
    const payer = Keypair.fromSecretKey(secret);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    console.log('✓ BPMarket config initialized, signature:', sig);
  } catch (e) {
    console.error('✗ Failed to init BPMarket config:', e.message);
    if (e.logs) {
      console.error('Logs:', e.logs);
    }
    if (e.getLogs) {
      console.error('Full logs:', await e.getLogs());
    }
    process.exit(1);
  }
})();
