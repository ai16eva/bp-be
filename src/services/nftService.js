const { PublicKey } = require('@solana/web3.js');
const { createSolanaConnection, getGovernanceSDK } = require('../config/solana');

let Metaplex = null;
let metaplexAvailable = false;

try {
  const metaplexModule = require('@metaplex-foundation/js');
  Metaplex = metaplexModule.Metaplex;
  metaplexAvailable = true;
} catch (error) {
}

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

async function fetchNFTsFromBlockchain(walletAddress, collectionAddress = null) {
  const connection = createSolanaConnection();
  const governance = getGovernanceSDK();
  
  if (!governance) {
    throw new Error('GovernanceSDK not available');
  }

  const [collectionMintPDA] = governance.getCollectionMintPDA();
  const targetCollectionMint = collectionAddress 
    ? new PublicKey(collectionAddress) 
    : collectionMintPDA;
  
  const targetCollectionAddress = targetCollectionMint.toBase58();

  const walletPubkey = new PublicKey(walletAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    walletPubkey,
    { programId: new PublicKey(TOKEN_PROGRAM_ID) }
  );

  const nftAccounts = [];

  let metaplex = null;
  if (Metaplex && metaplexAvailable) {
    try {
      metaplex = Metaplex.make(connection);
    } catch (error) {
    }
  }

  for (const { pubkey, account } of tokenAccounts.value) {
    try {
      const parsed = account?.data?.parsed;
      const info = parsed?.info;
      const tokenAmount = info?.tokenAmount;
      const amountStr = tokenAmount?.amount;
      const decimals = tokenAmount?.decimals;

      if (amountStr !== '1' || decimals !== 0) {
        continue;
      }

      const mintAddress = info?.mint;
      if (!mintAddress) {
        continue;
      }

      try {
        const mintPk = new PublicKey(mintAddress);
        let metadataAccount = null;
        let collectionKey = null;
        let isVerified = false;

        if (metaplex) {
          try {
            const metadata = await metaplex
              .nfts()
              .findByMint({ mintAddress: mintPk, loadJsonMetadata: false });
            if (metadata?.metadataAddress) {
              metadataAccount = metadata.metadataAddress.toBase58();
            }
            if (metadata?.collection?.address) {
              collectionKey = metadata.collection.address.toBase58();
              isVerified = Boolean(metadata.collection.verified ?? true);
            }
          } catch (error) {
          }
        }

        if (!metadataAccount) {
          const [metadataAccountPDA] = governance.getMetadataAccountPDA(mintPk);
          metadataAccount = metadataAccountPDA.toBase58();
        }

        if (!collectionKey) {
          try {
            const [metadataAccountPDA] = governance.getMetadataAccountPDA(mintPk);
            const metadataAccountInfo = await connection.getAccountInfo(metadataAccountPDA);
            
            if (metadataAccountInfo && metadataAccountInfo.data.length > 0) {
              try {
                const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
                const metadata = Metadata.fromAccountInfo(metadataAccountInfo);
                
                if (metadata[0]?.collection) {
                  collectionKey = metadata[0].collection.key.toBase58();
                  isVerified = metadata[0].collection.verified;
                }
              } catch (parseError) {
              }
            }
          } catch (fallbackError) {
          }
        }

        if (!collectionKey) {
          continue;
        }

        const isInCollection = collectionKey === targetCollectionAddress;
        
        if (!isInCollection || !isVerified) {
          continue;
        }

        nftAccounts.push({
          mint: mintAddress,
          tokenAccount: pubkey.toBase58(),
          metadataAccount,
          amount: amountStr,
        });

      } catch (error) { 
        continue;
      }
    } catch (error) {
      continue;
    }
  }

  return nftAccounts;
}

module.exports = {
  fetchNFTsFromBlockchain,
};

