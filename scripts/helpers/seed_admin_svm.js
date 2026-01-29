require('dotenv').config();
const models = require('../../src/models/mysql');

function arg(name){ const i=process.argv.indexOf(name); return i>=0?process.argv[i+1]:null; }

(async () => {
  const env = process.env.NODE_ENV || 'dev';
  const pubkeyArg = arg('--pubkey');
  const pubkeyEnv = process.env.SOLANA_MASTER_WALLET || (env === 'dev' ? process.env.SOLANA_MASTER_WALLET_DEV : undefined);
  // Default wallet if not provided
  const defaultWallet = 'D93oSAaG2J4ThVSb7brYhxYFWGMXd72mfWzibMAR8Fid';
  const pubkey = pubkeyArg || pubkeyEnv || defaultWallet;

  const MemberModel = models.members;
  let found = await MemberModel.findOne({ where: { wallet_address: pubkey } });
  if (!found) {
    found = await MemberModel.create({
      wallet_address: pubkey,
      wallet_type: 'SOLANA',
      member_role: 'ADMIN',
      member_email_verified: 'F',
    });
    console.log(`✓ Created admin: ${pubkey}`);
  } else {
    if (found.member_role !== 'ADMIN' || found.wallet_type !== 'SOLANA') {
      await found.update({ member_role: 'ADMIN', wallet_type: 'SOLANA' });
      console.log(`✓ Updated to ADMIN: ${pubkey}`);
    } else {
      console.log(`✓ Admin already exists: ${pubkey}`);
    }
  }
  process.exit(0);
})().catch((e)=>{ console.error('✗ Error:', e); process.exit(1); });
