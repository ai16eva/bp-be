const path = require('path');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const { BN } = require('@coral-xyz/anchor');
const { getGovernanceSDK, createSolanaConnection } = require('../../src/config/solana');

try {
    const envName = process.env.NODE_ENV ? ('.env.' + process.env.NODE_ENV) : '.env';
    require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
    require('dotenv').config();
} catch (_) { }

(async () => {
    console.log('--- KHỞI TẠO GOVERNANCE (DIRECT MODE) ---');

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

    console.log(`Mạng: ${process.env.NODE_ENV || 'dev'}`);
    console.log(`Admin Wallet: ${admin.publicKey.toBase58()}`);
    console.log(`Program ID: ${governanceSDK.program.programId.toBase58()}`);

    try {
        try {
            const existingGov = await governanceSDK.fetchGovernance();
            if (existingGov) {
                console.log('✓ Governance đã được khởi tạo trước đó.');
                console.log('  Collection hiện tại:', existingGov.collectionMint.toBase58());
                process.exit(0);
            }
        } catch (e) {
            console.log('Governance chưa khởi tạo, bắt đầu tạo mới...');
        }

        const config = {
            minTotalVote: new BN(1),
            maxTotalVote: new BN(50),
            minRequiredNft: 1,
            maxVotableNft: 5,
            durationHours: new BN(24),
            constantRewardToken: new BN(10).mul(new BN(10).pow(new BN(9))),
            baseTokenMint: new PublicKey(process.env.BASE_TOKEN_MINT || 'GVi8Ce9QdL18QrD4WBjJznxtaoQefxJT5bNqUodTcZ7R'),
            baseNftCollection: admin.publicKey,
            authority: admin.publicKey
        };

        console.log('Đang gửi transaction khởi tạo...');
        const tx = await governanceSDK.initialize(
            config.minTotalVote,
            config.maxTotalVote,
            config.minRequiredNft,
            config.maxVotableNft,
            config.durationHours,
            config.constantRewardToken,
            config.baseTokenMint,
            config.baseNftCollection,
            config.authority,
            admin.publicKey
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = admin.publicKey;
        tx.sign(admin);

        const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            maxRetries: 3
        });
        console.log(`✓ Gửi thành công! Signature: ${sig}`);

        console.log('Đang xác nhận (confirm)...');
        await connection.confirmTransaction({
            signature: sig,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');
        console.log('✓ Hoàn tất khởi tạo Governance!');

    } catch (error) {
        console.error('✗ Lỗi khởi tạo:', error.message);
        if (error.logs) console.error('Logs:', error.logs);
        process.exit(1);
    }
})();
