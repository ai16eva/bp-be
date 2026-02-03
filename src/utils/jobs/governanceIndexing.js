const { reindexCollection } = require('../../services/governanceIndexerService');

/**
 * Job to reindex the governance NFT collection and sync with Helius.
 * This ensures the database and webhooks are up to date periodically.
 */
async function runGovernanceIndexing() {
    console.log('[Job] Starting automated governance indexing...');
    try {
        const result = await reindexCollection();
        console.log(`[Job] Automated indexing complete. Total: ${result.total}, Webhook Synced: ${result.webhookSynced}`);
    } catch (error) {
        console.error('[Job] Automated indexing failed:', error.message);
    }
}

module.exports = { runGovernanceIndexing };
