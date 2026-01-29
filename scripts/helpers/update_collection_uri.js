const path = require('path');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const { getGovernanceSDK, createSolanaConnection } = require('../../src/config/solana');

// Load env
try {
    const envName = process.env.NODE_ENV ? ('.env.' + process.env.NODE_ENV) : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

(async () => {
    console.log('--- CẬP NHẬT URI CHO GOVERNANCE COLLECTION ---');

    const connection = createSolanaConnection();
    const governanceSDK = getGovernanceSDK();

    const adminPk = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
    if (!adminPk) {
        console.error('✗ Lỗi: Thiếu Private Key trong file .env');
        process.exit(1);
    }

    const admin = Keypair.fromSecretKey(
        adminPk.startsWith('[') ? Uint8Array.from(JSON.parse(adminPk)) : bs58.decode(adminPk)
    );

    const newUri = "https://gateway.pinata.cloud/ipfs/QmdoH3A1usevgyNUhszMKAb2xYPi9EiEfw9fWjH188Kbq3";
    const name = "Boomplay Governance Collection";
    const symbol = "BPC";

    console.log(`Mạng: ${process.env.NODE_ENV || 'dev'}`);
    console.log(`URI Mới: ${newUri}`);
    console.log(`Admin Wallet: ${admin.publicKey.toBase58()}`);

    try {
        const govData = await governanceSDK.fetchGovernance();
        if (!govData || govData.collectionMint.toBase58() === "11111111111111111111111111111111") {
            console.error('✗ Lỗi: Chưa tìm thấy Collection Mint trong Governance. Hãy chạy lệnh tạo collection trước!');
            process.exit(1);
        }

        const collectionMint = govData.collectionMint;
        console.log('✓ Tìm thấy Collection Mint:', collectionMint.toBase58());

        console.log('Đang gửi transaction cập nhật metadata...');
        const tx = await governanceSDK.updateCollection(name, symbol, newUri, admin.publicKey);

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = admin.publicKey;
        tx.sign(admin);

        const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            maxRetries: 3
        });

        console.log(`✓ Gửi thành công! Signature: ${sig}`);
        console.log('Đang đợi xác nhận...');

        await connection.confirmTransaction({
            signature: sig,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');

        console.log('✓ CHÚC MỪNG! Metadata của bộ sưu tập đã được cập nhật thành công!');
        console.log('  URL IPFS mới đã có hiệu lực trên Solana.');

    } catch (error) {
        console.error('✗ Lỗi cập nhật:', error.message);
        if (error.logs) console.error('Logs:', error.logs);
        process.exit(1);
    }
})();
