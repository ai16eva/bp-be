try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const bs58 = require('bs58');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

(async () => {
  const walletAddress = arg('--wallet');
  const count = parseInt(arg('--count', '1'));

  if (!walletAddress) {
    console.error('Usage: node mint_governance_nft.js --wallet <wallet_address> [--count <number>]');
    console.error('Example: node mint_governance_nft.js --wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU --count 3');
    process.exit(1);
  }

  const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
  const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;

  if (!adminWallet || !adminSkStr) {
    throw new Error('Missing admin env vars (SOLANA_MASTER_WALLET_DEV, SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV)');
  }

  const admin = Keypair.fromSecretKey(
    adminSkStr.startsWith('[')
      ? Uint8Array.from(JSON.parse(adminSkStr))
      : bs58.decode(adminSkStr)
  );

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com',
    'confirmed'
  );

  const gov = new GovernanceSDK(connection);
  const userPubkey = new PublicKey(walletAddress);
  const adminPubkey = admin.publicKey;

  console.log(`Minting ${count} NFT(s) for wallet: ${walletAddress}`);
  console.log(`Admin wallet: ${adminWallet}`);
  console.log('');

  for (let i = 0; i < count; i++) {
    try {
      console.log(`✓ Minting NFT ${i + 1}/${count}...`);

      // Mint directly to user wallet (Authority is Admin, Receiver is User)
      const mintResult = await gov.mintGovernanceNft(
        `Governance NFT ${i + 1}`,
        'GOV',
        `https://example.com/governance-nft-${Date.now()}-${i}`,
        userPubkey, // Receiver
        adminPubkey // Authority (Signer)
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      mintResult.transaction.feePayer = admin.publicKey;
      mintResult.transaction.recentBlockhash = blockhash;
      mintResult.transaction.partialSign(admin, mintResult.nftMint);

      const mintSig = await connection.sendRawTransaction(
        mintResult.transaction.serialize(),
        { skipPreflight: true, maxRetries: 2 }
      );

      await connection.confirmTransaction(
        { signature: mintSig, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      console.log(`  ✓ NFT ${i + 1} minted directly to user wallet`);
      console.log(`    NFT Mint: ${mintResult.nftMint.publicKey.toString()}`);
      console.log(`    Mint Transaction: ${mintSig}`);
      console.log('');

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.error(`✗ Failed to mint NFT ${i + 1}:`, e.message);
      if (e?.logs) console.error('Transaction logs:', e.logs);
    }
  }

  console.log(`✓ Completed minting ${count} NFT(s) for ${walletAddress}`);
  process.exit(0);
})().catch(e => {
  console.error('✗ Script failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});

