const { err, success } = require('../utils/responses');
const validateWalletAddress = require('../validates/walletAddress');
const governanceNftActions = require('../database/governanceNftActions');
const { fetchNFTsFromBlockchain } = require('../services/nftService');
const { reindexCollection } = require('../services/governanceIndexerService');

module.exports = {
  getUserNFTs: async (req, res) => {
    try {
      let walletAddress = req.params.walletAddress;
      walletAddress = validateWalletAddress(walletAddress);

      const collectionAddress = req.query.collection || null;
      
      let actualCollectionAddress = collectionAddress;
      
      if (!actualCollectionAddress) {
        const { getGovernanceSDK } = require('../config/solana');
        const governance = getGovernanceSDK();
        const [collectionMintPDA] = governance.getCollectionMintPDA();
        actualCollectionAddress = collectionMintPDA.toBase58();
      }

      const dbNfts = await governanceNftActions.getByOwner(walletAddress, actualCollectionAddress);
      
      return res.status(200).json(success({
        walletAddress,
        collectionAddress: actualCollectionAddress,
        nfts: dbNfts.map(n => ({
          mint: n.mint,
          tokenAccount: n.tokenAccount,
          metadataAccount: n.metadataAccount,
          amount: String(n.amount ?? 1),
        })),
        count: dbNfts.length,
        cached: true,
        source: 'db',
      }));

    } catch (e) {
      const errorCode = e?.statusCode || 400;
      return res.status(errorCode).json(err(e));
    }
  },

  reindex: async (req, res) => {
    try {
      const collectionAddress = req.body?.collection || null;
      const result = await reindexCollection(collectionAddress || null);
      return res.status(200).json(success(result));
    } catch (e) {
      const errorCode = e?.statusCode || 400;
      return res.status(errorCode).json(err(e));
    }
  },
};

