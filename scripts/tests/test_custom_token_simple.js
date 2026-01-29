try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { BN } = require('@coral-xyz/anchor');
const { PublicKey, Connection, Keypair, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const { BPMarketSDK } = require('../../src/solana-sdk/dist/BPMarket');
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

(async () => {
  const customToken = new PublicKey(process.env.CUSTOM_BETTING_TOKEN || '6HXWa6EXRakLTfBrNM9B5rM9YS8qLNtkZb5cabYzvFNs');

  console.log('🧪 Simple Custom Token Test (No Backend Required)');
  console.log('🎯 Custom Token:', customToken.toBase58());

  const rpcUrl = process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const sdk = new BPMarketSDK(connection);

  const adminKey = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(adminKey)));
  console.log('Admin:', admin.publicKey.toBase58());

  const marketKey = new BN(Math.floor(Date.now() / 1000));
  const answerKeys = [new BN(1), new BN(2)];

  console.log('\n[1] Publishing market with custom token');
  console.log('   Market Key:', marketKey.toString());

  const publishTx = await sdk.publishMarket({
    marketKey,
    creator: admin.publicKey,
    title: `Custom Token Test ${marketKey.toString()}`,
    bettingToken: customToken,
    createFee: new BN(0),
    creatorFeePercentage: new BN(100),
    serviceFeePercentage: new BN(100),
    charityFeePercentage: new BN(50),
    answerKeys,
  }, admin.publicKey);

  let bh = await connection.getLatestBlockhash('confirmed');
  publishTx.feePayer = admin.publicKey;
  publishTx.recentBlockhash = bh.blockhash;
  publishTx.sign(admin);

  const publishSig = await connection.sendRawTransaction(publishTx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: publishSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  console.log('   ✅ Market published, tx:', publishSig);

  await sleep(2000);

  const market = await sdk.fetchMarket(marketKey);
  console.log('   Verification - betting token:', market.bettingToken.toBase58());
  if (!market.bettingToken.equals(customToken)) {
    throw new Error('Token mismatch!');
  }
  console.log('   ✅ Token verified!');

  console.log('\n[2] Placing bets with custom token');
  const keysDir = path.resolve(__dirname, '../keys');
  const better1 = readKeypairFromFile(path.join(keysDir, 'voter1.json'));
  const better2 = readKeypairFromFile(path.join(keysDir, 'voter2.json'));

  const BET_AMOUNT = new BN(1e9); // 1 token

  async function placeBet(better, answerKey, label) {
    const betTx = await sdk.bet(marketKey, answerKey, BET_AMOUNT, better.publicKey);
    bh = await connection.getLatestBlockhash('confirmed');
    betTx.feePayer = better.publicKey;
    betTx.recentBlockhash = bh.blockhash;
    betTx.partialSign(better);

    const sig = await connection.sendRawTransaction(betTx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
    console.log(`   ${label} placed bet, tx:`, sig);

    const ata = await getAssociatedTokenAddress(customToken, better.publicKey);
    const bal = await connection.getTokenAccountBalance(ata);
    console.log(`   ${label} remaining balance: ${(Number(bal.value.amount) / 1e9).toFixed(4)} tokens`);
  }

  await placeBet(better1, answerKeys[0], 'Better1');
  await sleep(2000);
  await placeBet(better2, answerKeys[1], 'Better2');

  console.log('\n[3] Finishing market');
  const finishTx = await sdk.finishMarket(marketKey, admin.publicKey);
  bh = await connection.getLatestBlockhash('confirmed');
  finishTx.feePayer = admin.publicKey;
  finishTx.recentBlockhash = bh.blockhash;
  finishTx.sign(admin);

  const finishSig = await connection.sendRawTransaction(finishTx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: finishSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  console.log('   ✅ Market finished, tx:', finishSig);

  console.log('\n[4] Setting winning answer and success market');
  const winningAnswer = answerKeys[0];
  const config = await sdk.fetchConfig();
  const cojamAta = await getAssociatedTokenAddress(customToken, config.cojamFeeAccount, true);
  const charityAta = await getAssociatedTokenAddress(customToken, config.charityFeeAccount, true);
  const creatorAta = await getAssociatedTokenAddress(customToken, admin.publicKey);

  console.log('   Ensuring fee account ATAs...');
  const solanaTxService = require('../../src/services/solanaTxService');
  try {
    await solanaTxService.ensureSuccessTokenAccounts(marketKey.toString());
    console.log('   ✅ Fee accounts ready');
  } catch (e) {
    console.warn('   Warning ensuring ATAs:', e.message);
  }

  await sleep(2000);

  const successTx = await sdk.successMarket(marketKey, winningAnswer, admin.publicKey);
  bh = await connection.getLatestBlockhash('confirmed');
  successTx.feePayer = admin.publicKey;
  successTx.recentBlockhash = bh.blockhash;
  successTx.sign(admin);

  const successSig = await connection.sendRawTransaction(successTx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: successSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  console.log('   ✅ Market success, tx:', successSig);

  console.log('\n[5] Claiming rewards (winner gets custom token back)');
  const claimTx = await sdk.receiveToken(marketKey, winningAnswer, better1.publicKey);
  bh = await connection.getLatestBlockhash('confirmed');
  claimTx.feePayer = better1.publicKey;
  claimTx.recentBlockhash = bh.blockhash;
  claimTx.partialSign(better1);

  const claimSig = await connection.sendRawTransaction(claimTx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: claimSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  console.log('   ✅ Better1 claimed, tx:', claimSig);

  const ata = await getAssociatedTokenAddress(customToken, better1.publicKey);
  const finalBal = await connection.getTokenAccountBalance(ata);
  console.log('   Better1 final balance:', (Number(finalBal.value.amount) / 1e9).toFixed(4), 'custom tokens');

  console.log('\n✅ Simple custom token test completed successfully!');
  console.log('\nSummary:');
  console.log('  🎯 Custom Token:', customToken.toBase58());
  console.log('  ✅ Market published with custom token');
  console.log('  ✅ Bets placed using custom token');
  console.log('  ✅ Market finished and succeeded');
  console.log('  ✅ Winner claimed rewards in custom token');
  console.log('\n💡 This proves multi-token per market works correctly!');

})().catch((e) => {
  console.error('❌ Failed:', e.message || e);
  if (e.stack) console.error('Stack:', e.stack);
  process.exit(1);
});
