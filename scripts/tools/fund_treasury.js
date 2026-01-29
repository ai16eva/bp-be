

try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, createTransferInstruction } = require('@solana/spl-token');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

(async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
  console.log(`  Connecting to Solana RPC: ${rpcUrl}`);
  const connection = new Connection(rpcUrl, 'confirmed');
  const gov = new GovernanceSDK(connection);

  const amountStr = arg('--amount');
  if (!amountStr) {
    console.error('Usage: node fund_treasury.js --amount <amount_in_sol>');
    process.exit(1);
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    console.error('Amount must be a positive number');
    process.exit(1);
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

  try {
    console.log(' Fetching governance config...');
    const config = await gov.fetchConfig();
    if (!config) {
      throw new Error('Governance config not found on-chain');
    }

    const tokenMint = config.baseTokenMint || config.base_token_mint || new PublicKey('So11111111111111111111111111111111111111112');
    console.log(` Base token mint: ${tokenMint.toBase58()}`);

    const [treasuryPda] = gov.getTreasuryPDA();
    const [treasuryTokenAccount] = gov.getTreasuryTokenAccountPDA();

    console.log('  Ensuring admin associated token account exists...');
    const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      tokenMint,
      admin.publicKey,
      false,
      'confirmed'
    );

    if (tokenMint.toBase58() === 'So11111111111111111111111111111111111111112') {
      const amountLamports = Math.floor(amount * 1e9);
      console.log(`  Funding treasury with ${amount} SOL (${amountLamports} lamports)...`);
      const tx = new Transaction();

      tx.add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: adminTokenAccount.address,
          lamports: amountLamports,
        })
      );

      const { createSyncNativeInstruction } = require('@solana/spl-token');
      tx.add(
        createSyncNativeInstruction(
          adminTokenAccount.address,
          TOKEN_PROGRAM_ID
        )
      );

      tx.add(
        createTransferInstruction(
          adminTokenAccount.address,
          treasuryTokenAccount,
          admin.publicKey,
          amountLamports,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.sign(admin);

      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      );
      console.log(` Treasury funded. Transaction signature: ${sig}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } else {
      console.error('Token is not native SOL. Please use SPL token transfer.');
      process.exit(1);
    }
  } catch (e) {
    console.error(` Error:`, e?.message || e);
    if (e?.logs) {
      console.error(`Transaction logs:`, e.logs);
    }
    process.exit(1);
  }
})().catch(e => {
  console.error(' Unhandled error:', e?.message || e);
  if (e?.stack) console.error('Stack:', e.stack);
  process.exit(1);
});

