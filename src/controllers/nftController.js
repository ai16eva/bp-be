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

  mintNft: async (req, res) => {
    try {
      const { walletAddress, metadataUri, quantity = 5, name = 'Governance NFT', symbol = 'BGOV' } = req.body;

      if (!walletAddress || !metadataUri) {
        return res.status(400).json(err(new Error('Missing walletAddress or metadataUri')));
      }

      const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
      const { GovernanceSDK } = require('../solana-sdk/dist/Governance');
      const bs58 = require('bs58');
      const { getGovernanceSDK } = require('../config/solana');

      const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
      if (!adminSkStr) {
        throw new Error('Server misconfiguration: Missing Admin Key');
      }

      const admin = Keypair.fromSecretKey(
        adminSkStr.startsWith('[')
          ? Uint8Array.from(JSON.parse(adminSkStr))
          : bs58.decode(adminSkStr)
      );

      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
      );

      const gov = new GovernanceSDK(connection);
      const userPubkey = new PublicKey(walletAddress);

      const results = [];
      const errors = [];

      // Loop minting
      for (let i = 0; i < quantity; i++) {
        try {
          // If metadataUri is same for all, fine. If need unique, append index.
          // Frontend sends one URI for all usually.
          const nftName = `${name} #${i + 1}`;

          const mintResult = await gov.mintGovernanceNft(
            nftName,
            symbol,
            metadataUri,
            userPubkey,
            admin.publicKey
          );

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          mintResult.transaction.feePayer = admin.publicKey;
          mintResult.transaction.recentBlockhash = blockhash;
          mintResult.transaction.partialSign(admin, mintResult.nftMint);

          const mintSig = await connection.sendRawTransaction(
            mintResult.transaction.serialize(),
            { skipPreflight: true, maxRetries: 3 }
          );

          await connection.confirmTransaction(
            { signature: mintSig, blockhash, lastValidBlockHeight },
            'confirmed'
          );

          results.push({
            nft: mintResult.nftMint.publicKey.toBase58(),
            signature: mintSig
          });

        } catch (innerError) {
          console.error(`Failed to mint NFT ${i + 1}:`, innerError);
          errors.push({ index: i, error: innerError.message });
        }
      }

      // Trigger reindex in background
      if (results.length > 0) {
        reindexCollection(null).catch(e => console.error('Background reindex failed:', e));
      }

      return res.status(200).json(success({
        total: quantity,
        successCount: results.length,
        failedCount: quantity - results.length,
        results,
        errors
      }));

    } catch (e) {
      console.error('Mint API Error:', e);
      return res.status(500).json(err(new Error(e.message || 'Internal Server Error')));
    }
  },
};


