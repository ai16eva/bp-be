
const { Connection, Keypair, Transaction } = require('@solana/web3.js');

async function sendSignedTransaction(transaction) {
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL_DEV || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

    const privateKeyStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV;
    if (!privateKeyStr) {
      throw new Error('Missing SOLANA_MASTER_WALLET_PRIVATE_KEY environment variable');
    }

    let privateKey;
    if (privateKeyStr.startsWith('[')) {
      privateKey = Uint8Array.from(JSON.parse(privateKeyStr));
    } else {
      const bs58 = require('bs58');
      privateKey = bs58.decode(privateKeyStr);
    }

    const payer = Keypair.fromSecretKey(privateKey);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    if (!transaction.feePayer) {
      transaction.feePayer = payer.publicKey;
    }
    transaction.recentBlockhash = blockhash;

    transaction.sign(payer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    return {
      success: true,
      signature,
      transactionHash: signature,
      transaction
    };

  } catch (error) {
    console.error('Error sending transaction:', error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

module.exports = {
  sendSignedTransaction
};
