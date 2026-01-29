try {
    const path = require('path');
    const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const { BPMarketSDK, AccountType } = require('../../src/solana-sdk/dist/BPMarket');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
    try {
        const rpc = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com';
        const ownerStr = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;

        // Get account type and new address from arguments
        const accountTypeStr = arg('--type'); // cojamFee, charityFee, remain
        const newAddressStr = arg('--address');

        if (!accountTypeStr || !newAddressStr) {
            console.log('Usage: NODE_ENV=dev node set_fee_account.js --type <type> --address <address>');
            console.log('');
            console.log('Types:');
            console.log('  cojamFee    - Platform fee account');
            console.log('  charityFee  - Charity fee account');
            console.log('  remain      - Remain account');
            console.log('');
            console.log('Example:');
            console.log('  NODE_ENV=dev node set_fee_account.js --type charityFee --address 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
            process.exit(1);
        }

        if (!ownerStr) throw new Error('Missing SOLANA_MASTER_WALLET_DEV');

        const connection = new Connection(rpc, 'confirmed');
        const sdk = new BPMarketSDK(connection);

        // Validate account type
        let accountType;
        switch (accountTypeStr.toLowerCase()) {
            case 'cojamfee':
                accountType = AccountType.CojamFee;
                break;
            case 'charityfee':
                accountType = AccountType.CharityFee;
                break;
            case 'remain':
                accountType = AccountType.Remain;
                break;
            default:
                throw new Error(`Invalid account type: ${accountTypeStr}. Must be cojamFee, charityFee, or remain`);
        }

        const owner = new PublicKey(ownerStr);
        const newAddress = new PublicKey(newAddressStr);

        // Show current config
        const configBefore = await sdk.fetchConfig();
        console.log('Current config:');
        console.log('  Cojam Fee Account:', configBefore.cojamFeeAccount.toBase58());
        console.log('  Charity Fee Account:', configBefore.charityFeeAccount.toBase58());
        console.log('  Remain Account:', configBefore.remainAccount.toBase58());
        console.log('');

        console.log(`Setting ${accountTypeStr} to ${newAddress.toBase58()}...`);

        const tx = await sdk.setAccount(accountType, newAddress, owner);

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

        console.log('✓ Account updated, signature:', sig);
        console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

        // Show updated config
        const configAfter = await sdk.fetchConfig();
        console.log('');
        console.log('Updated config:');
        console.log('  Cojam Fee Account:', configAfter.cojamFeeAccount.toBase58());
        console.log('  Charity Fee Account:', configAfter.charityFeeAccount.toBase58());
        console.log('  Remain Account:', configAfter.remainAccount.toBase58());

    } catch (e) {
        console.error('✗ Failed to set account:', e.message);
        process.exit(1);
    }
})();
