const client = require('../../database/client');
const model = require('../../models/mysql');
const ReferralCodes = model.referral_codes
const { where, fn, col, Op } = require("sequelize");
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const { BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const { sleep } = require("../timeHandler");
const connection = new Connection(process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com', 'confirmed');
const solanaService = require('../../services/solanaTxService');
const tokenMint = new PublicKey(process.env.BASE_TOKEN_MINT);
const rewardWalletKeypair = (() => {
    const pk = process.env.SOLANA_DAILY_REWARD_WALLET_PRIVATE_KEY || process.env.SOLANA_REWARD_WALLET_PRIVATE_KEY;
    if (!pk) throw new Error('Missing reward wallet private key');
    let secret;
    if (pk.startsWith('[')) {
        secret = Uint8Array.from(JSON.parse(pk));
    } else {
        secret = bs58.decode(pk);
    }
    return Keypair.fromSecretKey(secret);
})();
const decimals = parseInt(process.env.SOLANA_TOKEN_DECIMALS || '9', 10);
module.exports = {
    rewardReferrals: async (count = 5) => {
        try {
            const fiveReferrals = await client.Referral.getReferrals(count)
            for (const fiveReferral of fiveReferrals) {
                const wallet_address = fiveReferral.wallet_address;
                const user = await ReferralCodes.findOne({
                    where: where(
                        fn('LOWER', col('wallet_address')),
                        Op.eq,
                        fn('LOWER', wallet_address)
                    )
                })
                if (count === 5) {
                    if (user && user.five_referral_rewarded_at == null) {
                        try {
                            await client.ActivityRewardActions.createActivityReward(wallet_address, 210, "FIVE_REFERRAL");
                            await ReferralCodes.update(
                                {
                                    five_referral_rewarded_at: new Date(),
                                },
                                {
                                    where: where(
                                        fn('LOWER', col('wallet_address')),
                                        Op.eq,
                                        fn('LOWER', wallet_address)
                                    )
                                }
                            )
                        } catch (e) {
                            console.log(e)
                        }
                    }
                }

            }
        } catch (e) {
            console.log(e)
        }
    },
    runRewards: async () => {
        console.log('----Point Reward (Solana) started----')
        const users = await client.ActivityRewardActions.getNotRewarded()
        for (const user of users) {
            try {
                const userPubkey = new PublicKey(user.wallet_address);
                const rewardWallet = rewardWalletKeypair.publicKey;

                const amountLamports = new BN(String(user.reward_amount))
                    .mul(new BN(10).pow(new BN(decimals)))
                    .toNumber();

                const fromTokenAccount = await getAssociatedTokenAddress(tokenMint, rewardWallet);
                const toTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);

                const transaction = new Transaction();
                const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
                if (!toAccountInfo) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            rewardWallet,
                            toTokenAccount,
                            userPubkey,
                            tokenMint
                        )
                    );
                }
                transaction.add(
                    createTransferInstruction(
                        fromTokenAccount,
                        toTokenAccount,
                        rewardWallet,
                        amountLamports,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );

                const result = await solanaService.sendAndConfirmTransaction(transaction, [rewardWalletKeypair]);
                console.log(result.signature);
                await client.ActivityRewardActions.updateRewardDate(user.id, result.signature);
                await sleep(1000)
            } catch (e) {
                console.log(e)
            }
        }
        console.log('----Point Reward (Solana) finished----')
    }
}