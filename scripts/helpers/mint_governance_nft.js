const path = require('path');
try {
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { GovernanceSDK } = require('../../src/solana-sdk/dist/Governance');
const bs58 = require('bs58');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}


async function uploadToPinata(content, fileName, apiKey, secretKey) {
  const data = new FormData();
  data.append('file', content, { filepath: fileName });

  const metadata = JSON.stringify({
    name: fileName,
  });
  data.append('pinataMetadata', metadata);

  const options = JSON.stringify({
    cidVersion: 0,
  });
  data.append('pinataOptions', options);

  const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
    maxBodyLength: 'Infinity',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
  });

  return res.data.IpfsHash;
}

async function uploadMetadataToPinata(metadata, name, apiKey, secretKey) {
  const data = JSON.stringify({
    pinataOptions: { cidVersion: 0 },
    pinataMetadata: { name: `${name}_metadata.json` },
    pinataContent: metadata,
  });

  const res = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
  });

  return res.data.IpfsHash;
}

(async () => {
  const count = parseInt(arg('--count', '1'));
  const nftName = arg('--name', 'Governance NFT');
  const nftSymbol = arg('--symbol', 'GOV');

  const adminWallet = process.env.SOLANA_MASTER_WALLET_DEV || process.env.SOLANA_MASTER_WALLET;
  const adminSkStr = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_API_KEY;

  if (!adminWallet || !adminSkStr) {
    throw new Error('Missing admin env vars (SOLANA_MASTER_WALLET_DEV, SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV)');
  }

  const admin = Keypair.fromSecretKey(
    adminSkStr.startsWith('[')
      ? Uint8Array.from(JSON.parse(adminSkStr))
      : bs58.decode(adminSkStr)
  );

  let walletAddress = arg('--wallet');

  if (!walletAddress) {
    console.error('❌ Error: Destination wallet address is required.');
    console.error('   Usage: node mint_governance_nft.js --wallet <USER_WALLET_ADDRESS>');
    process.exit(1);
  }

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com',
    'confirmed'
  );

  const gov = new GovernanceSDK(connection);
  const userPubkey = new PublicKey(walletAddress);
  const adminPubkey = admin.publicKey;

  console.log(`Minting ${count} NFT(s) for wallet: ${walletAddress}`);
  console.log(`Admin wallet: ${adminWallet}`);
  console.log('--------------------------------------------------');

  let metadataUri = '';

  if (!pinataApiKey || !pinataSecretKey) {
    console.error('❌ Error: PINATA_API_KEY and PINATA_SECRET_API_KEY are required in .env');
    process.exit(1);
  }

  let imagePath = arg('--image');

  // Default to project logo if no image provided
  if (!imagePath) {
    imagePath = path.resolve(__dirname, '../../src/public/logo-short.png');
  }

  if (!fs.existsSync(imagePath)) {
    console.error('❌ Error: Image file not found!');
    console.error(`   Path: ${imagePath}`);
    console.error('   Please provide a valid path via --image or ensure src/public/logo-short.png exists.');
    process.exit(1);
  }

  console.log('Using Pinata for metadata storage...');
  try {
    console.log(`Reading image from: ${imagePath}`);
    const imageBuffer = fs.createReadStream(imagePath);
    const imageFileName = path.basename(imagePath);

    console.log('Uploading image to IPFS...');
    const imageHash = await uploadToPinata(imageBuffer, imageFileName, pinataApiKey, pinataSecretKey);
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
    console.log(`Image uploaded: ${imageUrl}`);

    const metadata = {
      name: nftName,
      symbol: nftSymbol,
      description: 'Governance NFT granting voting rights and DAO participation.',
      image: imageUrl,
      external_url: 'https://moonraise.io',
      seller_fee_basis_points: 0,
      attributes: [
        { trait_type: 'Type', value: 'Governance Token' },
        { trait_type: 'Utility', value: 'Voting' },
        { trait_type: 'Mint Date', value: new Date().toISOString().split('T')[0] }
      ],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: 'image/png',
          }
        ],
        category: 'image',
        creators: [
          {
            address: adminWallet,
            share: 100,
          },
        ],
      },
    };

    console.log('Uploading metadata JSON to IPFS...');
    const metadataHash = await uploadMetadataToPinata(metadata, `${nftName.replace(/\s+/g, '_')}`, pinataApiKey, pinataSecretKey);
    metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
    console.log(`Metadata uploaded: ${metadataUri}`);

  } catch (e) {
    console.error('Failed to upload to Pinata:', e.message);
    if (e.response) console.error('Pinata Error:', e.response.data);
    process.exit(1);
  }



  console.log(`\nStarting Mint Process with URI: ${metadataUri}`);
  console.log('--------------------------------------------------');

  for (let i = 0; i < count; i++) {
    try {

      const currentUri = (pinataApiKey && pinataSecretKey)
        ? metadataUri
        : `${metadataUri}-${i}`;

      console.log(`✓ Minting NFT ${i + 1}/${count}...`);

      const mintResult = await gov.mintGovernanceNft(
        `${nftName} #${i + 1}`,
        nftSymbol,
        currentUri,
        userPubkey,
        adminPubkey
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      mintResult.transaction.feePayer = admin.publicKey;
      mintResult.transaction.recentBlockhash = blockhash;
      mintResult.transaction.partialSign(admin, mintResult.nftMint);

      const mintSig = await connection.sendRawTransaction(
        mintResult.transaction.serialize(),
        { skipPreflight: true, maxRetries: 3 }
      );

      console.log(`  -> Tx Sent: ${mintSig}`);

      await connection.confirmTransaction(
        { signature: mintSig, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      console.log(`  ✓ Unlocked! NFT Address: ${mintResult.nftMint.publicKey.toString()}`);
      console.log('');

    } catch (e) {
      console.error(`✗ Failed to mint NFT ${i + 1}:`, e.message);
      if (e?.logs) console.error('Transaction logs:', e.logs);
    }
  }

  console.log(`✓ Completed minting ${count} NFT(s) for ${walletAddress}`);
  process.exit(0);
})().catch(e => {
  console.error('✗ Script failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});

