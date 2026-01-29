// Load env files first
try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) {}

const axios = require('axios');
const governanceNftActions = require('../src/database/governanceNftActions');
const models = require('../src/models/mysql');
const { getGovernanceSDK } = require('../src/config/solana');
const heliusService = require('../src/services/helius.service');

const HELIUS_URL = process.env.HELIUS_RPC_URL;
const WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;
if (!HELIUS_URL) {
  console.error(
    'Error: HELIUS_RPC_URL or SOLANA_RPC_URL_DEV environment variable required'
  );
  process.exit(1);
}

const governance = getGovernanceSDK();

async function indexAllWithHelius() {
  // Get collection mint PDA from governance
  const [collectionMintPDA] = governance.getCollectionMintPDA();
  const COLLECTION = collectionMintPDA.toBase58();
  
  console.log('Indexing governance collection...');
  console.log('Collection:', COLLECTION);
  console.log();

  let page = 1;
  const limit = 100;
  let totalIndexed = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.post(HELIUS_URL, {
        jsonrpc: '2.0',
        id: `page-${page}`,
        method: 'searchAssets',
        params: {
          grouping: ['collection', COLLECTION],
          page,
          limit,
        },
      });

      const result = response.data.result;
      const items = result?.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const nft of items) {
        try {
          const mint = nft.id;
          const owner = nft.ownership?.owner;

          let tokenAccount = null;
          if (owner && mint) {
            const { PublicKey } = require('@solana/web3.js');
            const {
              getAssociatedTokenAddress,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            } = require('@solana/spl-token');
            const mintPk = new PublicKey(mint);
            const ownerPk = new PublicKey(owner);
            const ata = await getAssociatedTokenAddress(
              mintPk,
              ownerPk,
              false,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            tokenAccount = ata.toBase58();
          }

          let metadataAccount = nft.content?.metadata?.address || '';

          if (!metadataAccount) {
            const { PublicKey } = require('@solana/web3.js');
            const { getGovernanceSDK } = require('../src/config/solana');
            const governance = getGovernanceSDK();

            const mintPk = new PublicKey(mint);
            const [metaPDA] = governance.getMetadataAccountPDA(mintPk);
            metadataAccount = metaPDA.toBase58();
          }

          if (!owner || !tokenAccount) {
            continue;
          }

          await governanceNftActions.upsertNft(
            mint,
            metadataAccount,
            COLLECTION
          );

          const GovernanceNftOwner = models.governance_nft_owners;
          const existing = await GovernanceNftOwner.findOne({
            where: {
              mint,
              owner_wallet: owner,
            },
          });

          if (existing) {
            await existing.update({
              token_account: tokenAccount,
              amount: 1,
              updated_at: new Date(),
            });
          } else {
            await governanceNftActions.upsertOwner(
              mint,
              tokenAccount,
              owner,
              1
            );
          }

          totalIndexed++;

          if (totalIndexed % 100 === 0) {
            console.log(`  Indexed ${totalIndexed} NFTs...`);
          }
        } catch (nftError) {}
      }

      if (items.length < limit) {
        hasMore = false;
      } else {
        page++;
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (pageError) {
      hasMore = false;
    }
  }

  console.log('\nIndexing complete');
  console.log('Total NFTs indexed:', totalIndexed);

  const nftCount = await models.governance_nfts.count();
  const ownerCount = await models.governance_nft_owners.count();
  const [owners] = await models.sequelize.query(
    'SELECT COUNT(DISTINCT owner_wallet) as count FROM governance_nft_owners'
  );

  console.log('\nDatabase status:');
  console.log('  Unique NFTs:', nftCount);
  console.log('  Unique wallets:', owners[0].count);

  console.log('\n========================================');
  console.log('Syncing Webhook Subscriptions');
  console.log('========================================\n');

  if (!WEBHOOK_ID) {
    console.log('⚠️  HELIUS_WEBHOOK_ID not set in .env');
    console.log('   Skipping webhook sync.');
    console.log('\nTo enable webhook sync:');
    console.log('   1. Get your webhook ID:');
    console.log('      node scripts/list_webhooks.js');
    console.log('   2. Add to .env:');
    console.log('      HELIUS_WEBHOOK_ID=your-webhook-id');
    console.log();
  } else {
    try {
      console.log(`Webhook ID: ${WEBHOOK_ID}`);
      console.log(`Updating with ${owners[0].count} owner wallets...`);

      const updateResult = await heliusService.updateWebhook(WEBHOOK_ID);

      console.log('\n Webhook updated successfully!');
      console.log(`   Subscribed to ${owners[0].count} wallets`);
      console.log(`   Webhook URL: ${updateResult.webhookURL || 'N/A'}`);
    } catch (webhookError) {
      console.error('\n Error updating webhook:', webhookError.message);
      console.log('\nTroubleshooting:');
      console.log('   1. Check if webhook ID is correct');
      console.log('   2. Verify HELIUS_API_KEY is valid');
      console.log('   3. Run: node scripts/list_webhooks.js');
    }
  }

  console.log('\n========================================');
  console.log('All Tasks Completed');
  console.log('========================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log();

  return {
    totalIndexed,
    nftCount,
    ownerCount,
    uniqueWallets: owners[0].count,
    webhookSynced: !!WEBHOOK_ID,
  };
}

if (require.main === module) {
  indexAllWithHelius()
    .then((result) => {
      console.log('\nDone');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nError:', err.message);
      process.exit(1);
    });
}

module.exports = { indexAllWithHelius };
