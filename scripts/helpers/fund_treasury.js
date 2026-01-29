
try {
    const path = require('path');
    const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const { BN } = require('@coral-xyz/anchor');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
    try {
        const rpc = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
        const ownerStr = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;

        // Default funding amount: 1000 tokens
        const amountStr = arg('--amount', '1000');

        if (!ownerStr) throw new Error('Missing SOLANA_MASTER_WALLET_DEV');

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');

        console.log(`Connecting to ${rpc}...`);
        const connection = new Connection(rpc, 'confirmed');
        const sdk = new GovernanceSDK(connection);

        // 1. Get Treasury PDA and Token Account
        const [treasuryPDA] = sdk.getTreasuryTokenAccountPDA();
        const config = await sdk.fetchConfig();
        const baseTokenMint = config.baseTokenMint; // Governance uses its own configured base token

        console.log('Governance Config Found:');
        console.log('  Base Token Mint:', baseTokenMint.toBase58());
        console.log('  Treasury Token Account (PDA):', treasuryPDA.toBase58());

        // 2. Setup Sender (Admin)
        const pkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
        if (!pkStr) throw new Error('Missing SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV');
        const secret = pkStr.startsWith('[') ? Uint8Array.from(JSON.parse(pkStr)) : bs58.decode(pkStr);
        const senderKeypair = Keypair.fromSecretKey(secret);
        const senderPublicKey = senderKeypair.publicKey;

        // 3. Get Sender's Token Account
        const senderTokenAccount = await getAssociatedTokenAddress(baseTokenMint, senderPublicKey);

        // Check sender balance
        try {
            const senderBalance = await connection.getTokenAccountBalance(senderTokenAccount);
            console.log(`  Sender Balance: ${senderBalance.value.uiAmount} tokens`);
            if (senderBalance.value.uiAmount < amount) {
                throw new Error(`Insufficient balance. You have ${senderBalance.value.uiAmount}, checking ${amount}.`);
            }
        } catch (e) {
            throw new Error(`Failed to check sender balance. Ensure you have the token ${baseTokenMint.toBase58()}. Error: ${e.message}`);
        }

        // 4. Create Transfer Transaction
        // Treasury PDA is a Token Account itself (initialized by governance program), so we transfer directly to it?
        // Wait, GovernanceSDK.ts: getTreasuryTokenAccountPDA derives an address.
        // In initialize_governance, it creates a token account at this address.

        console.log(`Funding Treasury with ${amount} tokens...`);

        // Assuming 9 decimals standard, or fetch from mint
        const decimals = 9;
        const amountRaw = BigInt(Math.floor(amount * Math.pow(10, decimals)));

        const tx = new Transaction().add(
            createTransferInstruction(
                senderTokenAccount,
                treasuryPDA,
                senderPublicKey,
                amountRaw,
                [],
                TOKEN_PROGRAM_ID
            )
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.feePayer = senderPublicKey;
        tx.recentBlockhash = blockhash;
        tx.sign(senderKeypair);

        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
        console.log('Transaction sent:', sig);

        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        console.log('✓ Treasury Funded Successfully!');
        console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

    } catch (e) {
        console.error('✗ Failed to fund treasury:', e.message);
        process.exit(1);
    }
})();
