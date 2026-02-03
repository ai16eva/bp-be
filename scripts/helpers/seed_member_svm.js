require('dotenv').config();
const models = require('../../src/models/mysql');

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }

(async () => {
    const path = require('path');
    const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
    require('dotenv').config({ path: path.resolve(__dirname, '../../', envName) });

    const pubkey = arg('--pubkey');
    if (!pubkey) {
        console.error('Please provide --pubkey');
        process.exit(1);
    }

    const MemberModel = models.members;
    let found = await MemberModel.findOne({ where: { wallet_address: pubkey } });

    const defaultRole = 'USER';
    const defaultWalletType = 'SOLANA';

    if (!found) {
        found = await MemberModel.create({
            wallet_address: pubkey,
            wallet_type: defaultWalletType,
            member_role: defaultRole,
            member_email_verified: 'F',
        });
        console.log(`✓ Created member (${defaultRole}): ${pubkey}`);
    } else {
        if (found.member_role !== defaultRole || found.wallet_type !== defaultWalletType) {

            await found.update({ member_role: defaultRole, wallet_type: defaultWalletType });
            console.log(`✓ Updated to ${defaultRole}: ${pubkey}`);
        } else {
            console.log(`✓ Member (${defaultRole}) already exists: ${pubkey}`);
        }
    }
    process.exit(0);
})().catch((e) => { console.error('✗ Error:', e); console.error(e); process.exit(1); });
