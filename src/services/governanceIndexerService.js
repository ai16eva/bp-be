const { PublicKey } = require('@solana/web3.js');
const { getSolanaConfig, getGovernanceSDK } = require('../config/solana');
const governanceNftActions = require('../database/governanceNftActions');

let createUmi = null;
let dasApi = null;
let das = null;

function getRpcUrl() {
  const cfg = getSolanaConfig();
  return cfg?.rpcUrl;
}

async function reindexCollection(inputCollectionAddress = null) {
  if (!createUmi || !dasApi || !das) {
    try {
      const umiBundle = require('@metaplex-foundation/umi-bundle-defaults');
      createUmi = umiBundle.createUmi;

      const dasApiModule = require('@metaplex-foundation/digital-asset-standard-api');
      dasApi = dasApiModule.dasApi;

      const dasModule = require('@metaplex-foundation/mpl-core-das');
      das = dasModule.das;
    } catch (e) {
      throw new Error(`UMI DAS setup failed: ${e.message}. Install @metaplex-foundation/umi-bundle-defaults, @metaplex-foundation/digital-asset-standard-api, @metaplex-foundation/mpl-core-das`);
    }
  }

  const governance = getGovernanceSDK();
  const [defaultCollection] = governance.getCollectionMintPDA();

  const collectionMint = inputCollectionAddress
    ? new PublicKey(inputCollectionAddress)
    : defaultCollection;
  const collectionAddress = collectionMint.toBase58();

  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    throw new Error('RPC URL not configured');
  }

  const umi = createUmi(rpcUrl);
  umi.use(dasApi());

  let page = 1;
  const limit = 100;
  let total = 0;

  while (true) {
    const resp = await das.getAssetsByCollection(umi, {
      collection: collectionAddress,
      page,
      limit,
    });

    const items = resp?.items || [];
    if (!items.length) break;

    for (const a of items) {
      try {
        const mint = a?.id;
        const ownerWallet = a?.ownership?.owner || null;
        const tokenAccount = a?.ownership?.token || '';
        const metadataAccount = a?.content?.metadata?.address || '';

        if (!mint || !ownerWallet) continue;

        await governanceNftActions.upsertNft(mint, metadataAccount, collectionAddress);
        await governanceNftActions.upsertOwner(mint, tokenAccount, ownerWallet, 1);
        total += 1;
      } catch (_) {
        continue;
      }
    }

    if (items.length < limit) break;
    page += 1;
  }

  return { collectionAddress, total, pagesScanned: page - 1 };
}

module.exports = {
  reindexCollection,
};
