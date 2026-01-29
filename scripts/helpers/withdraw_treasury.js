try {
    const path = require('path');
    const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

const {
    Connection,
    Keypair,
    PublicKey,
} = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const { BN } = require('@coral-xyz/anchor');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const bs58 = require('bs58');

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

/**
 * Helper function to parse command line arguments
 */
function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}

function hasFlag(name) {
    return process.argv.includes(name);
}

async function main() {
    // Parse arguments
    const withdrawAll = hasFlag('--all');
    const amountArg = arg('--amount');

    if (!withdrawAll && !amountArg) {
        console.log('Usage: NODE_ENV=dev node withdraw_treasury.js [--all | --amount <amount>]');
        console.log('');
        console.log('Options:');
        console.log('  --all              Withdraw all tokens from treasury');
        console.log('  --amount <number>  Withdraw specific amount (in tokens, e.g., 100)');
        console.log('');
        console.log('Example:');
        console.log('  NODE_ENV=dev node withdraw_treasury.js --all');
        console.log('  NODE_ENV=dev node withdraw_treasury.js --amount 100');
        process.exit(1);
    }

    // Connect to Solana
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log('Connected to Solana:', RPC_URL);

    // Initialize SDK
    const gov = new GovernanceSDK(connection);

    // Wallet setup (Admin)
    const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
    if (!adminSkStr) {
        throw new Error('SOLANA_MASTER_WALLET_PRIVATE_KEY or SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV not found in .env');
    }
    const adminKey = Uint8Array.from(bs58.decode(adminSkStr));
    const adminKeypair = Keypair.fromSecretKey(adminKey);
    const adminPubkey = adminKeypair.publicKey;
    console.log('Admin Pubkey:', adminPubkey.toBase58());

    // Check config to get base token mint
    const config = await gov.fetchConfig();
    if (!config) {
        throw new Error('Governance config not initialized');
    }
    const baseTokenMint = config.baseTokenMint;
    console.log('Base Token Mint:', baseTokenMint.toBase58());

    // Check Treasury balance
    const [treasuryTokenAccount] = gov.getTreasuryTokenAccountPDA();
    console.log('Treasury Token Account:', treasuryTokenAccount.toBase58());

    let treasuryBalanceAmount;
    try {
        const treasuryBalance = await connection.getTokenAccountBalance(treasuryTokenAccount);
        treasuryBalanceAmount = treasuryBalance.value.amount; // raw amount (with decimals)
        console.log('Treasury Balance:', treasuryBalance.value.uiAmount, 'tokens');

        if (treasuryBalance.value.uiAmount === 0) {
            console.log('Treasury is empty. Nothing to withdraw.');
            return;
        }
    } catch (e) {
        console.log('Treasury token account does not exist or is empty.');
        return;
    }

    // Calculate amount to withdraw
    let amountToWithdraw;
    const decimals = 9; // Assuming 9 decimals for SPL token

    if (withdrawAll) {
        amountToWithdraw = new BN(treasuryBalanceAmount);
        console.log('Withdrawing ALL tokens:', treasuryBalanceAmount, 'raw amount');
    } else {
        const tokenAmount = parseFloat(amountArg);
        if (isNaN(tokenAmount) || tokenAmount <= 0) {
            console.error('Invalid amount specified');
            process.exit(1);
        }
        amountToWithdraw = new BN(Math.floor(tokenAmount * 10 ** decimals));
        console.log('Amount to withdraw:', tokenAmount, 'tokens');
    }

    // Get Admin's associated token account to receive tokens
    const destinationTokenAccount = await getAssociatedTokenAddress(
        baseTokenMint,
        adminPubkey
    );
    console.log('Destination Token Account:', destinationTokenAccount.toBase58());

    console.log('');
    console.log('Withdrawing tokens...');
    try {
        const tx = await gov.withdrawTokens(
            amountToWithdraw,
            destinationTokenAccount,
            adminPubkey
        );

        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = adminPubkey;
        tx.sign(adminKeypair);

        const signature = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(signature);

        console.log('');
        console.log('✅ Success! Tokens withdrawn.');
        console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (error) {
        console.error('Error withdrawing tokens:', error);
        if (error.logs) {
            console.error("Logs:", error.logs);
        }
    }
}

main().catch(console.error);
