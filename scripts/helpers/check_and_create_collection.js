// Load env files
try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) { }

const { Connection, PublicKey, Transaction, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const { getGovernanceSDK, createSolanaConnection, getSolanaConfig } = require('../../src/config/solana');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// --- Pinata Helpers ---
async function uploadFileToPinata(filePath, fileName) {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error('Pinata API keys are missing in environment variables');
  }

  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  let data = new FormData();
  data.append('file', fs.createReadStream(filePath));

  const metadata = JSON.stringify({ name: fileName });
  data.append('pinataMetadata', metadata);

  const response = await axios.post(url, data, {
    maxBodyLength: 'Infinity',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET,
    },
  });

  return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
}

async function uploadJSONToPinata(jsonBody, fileName) {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error('Pinata API keys are missing in environment variables');
  }

  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
  const data = JSON.stringify({
    pinataMetadata: { name: fileName },
    pinataContent: jsonBody,
  });

  const response = await axios.post(url, data, {
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET,
    },
  });

  return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
}

async function checkAndCreateCollection() {
  console.log('Kiểm tra và tạo Governance Collection...\n');

  const config = getSolanaConfig();
  const connection = createSolanaConnection();
  const governanceSDK = getGovernanceSDK();

  const programId = governanceSDK.program.programId;
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Program ID: ${programId.toBase58()}`);
  console.log('');

  try {
    const governance = await governanceSDK.fetchGovernance();
    const collectionMint = governance.collectionMint
      ? (governance.collectionMint.toBase58 ? governance.collectionMint.toBase58() : governance.collectionMint)
      : null;

    console.log('Governance Account:');
    console.log(`  Collection Mint: ${collectionMint}`);
    console.log(`  Collection Created At: ${governance.collectionCreatedAt ? new Date(governance.collectionCreatedAt * 1000).toISOString() : 'N/A'}`);
    console.log('');

    const [collectionMintPDA] = governanceSDK.getCollectionMintPDA();
    console.log('Collection Mint PDA:');
    console.log(`  Address: ${collectionMintPDA.toBase58()}`);
    console.log(`  Expected: ${collectionMintPDA.toBase58()}`);
    console.log(`  Match: ${collectionMint === collectionMintPDA.toBase58() ? '✓' : '✗'}`);
    console.log('');

    let collectionExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(collectionMintPDA);
      collectionExists = accountInfo !== null;
      console.log(`  Account tồn tại: ${collectionExists ? '✓' : '✗'}`);
    } catch (e) {
      console.log(`  Account tồn tại: ✗ (${e.message})`);
    }
    console.log('');

    const defaultPubkey = PublicKey.default.toBase58();
    if (!collectionExists || !collectionMint || collectionMint === defaultPubkey) {
      console.log('Collection chưa được tạo!');
      console.log('');

      const adminPrivateKey = process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY_DEV || process.env.SOLANA_MASTER_WALLET_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('Missing SOLANA_MASTER_WALLET_PRIVATE_KEY[_DEV]');
      }

      const adminKeypair = Keypair.fromSecretKey(
        adminPrivateKey.startsWith('[')
          ? Uint8Array.from(JSON.parse(adminPrivateKey))
          : bs58.decode(adminPrivateKey)
      );
      const adminPubkey = adminKeypair.publicKey;
      console.log(`Admin Wallet: ${adminPubkey.toBase58()}`);
      console.log('');

      console.log('--- Chuẩn bị Metadata và Upload Pinata (IPFS) ---');

      const possibleLogoPaths = [
        path.resolve(process.cwd(), '../bpl-fe-lastest/public/logo-short.png'),
        path.resolve(process.cwd(), './node_modules/oboe/logo.png')
      ];

      let imageUrl = 'https://gateway.pinata.cloud/ipfs/QmZ8vR9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p9p'; // Default fallback
      for (const logoPath of possibleLogoPaths) {
        if (fs.existsSync(logoPath)) {
          console.log(`📤 Đang upload ảnh lên IPFS từ: ${logoPath}...`);
          try {
            imageUrl = await uploadFileToPinata(logoPath, `Boomplay_Logo_${Date.now()}`);
            console.log(`✅ Ảnh đã upload IPFS: ${imageUrl}`);
            break;
          } catch (e) {
            console.error('❌ Lỗi upload ảnh lên Pinata:', e.message);
          }
        }
      }

      console.log('📝 Đang tạo Metadata JSON...');
      const metadata = {
        name: 'Boomplay Governance Collection',
        symbol: 'BPC',
        description: 'The official governance collection for Boomplay DAO.',
        image: imageUrl,
        external_url: 'https://boomplay.io',
        properties: {
          files: [{ uri: imageUrl, type: 'image/png' }],
          category: 'image'
        }
      };

      let uri = '';
      try {
        uri = await uploadJSONToPinata(metadata, `Boomplay_Collection_Metadata_${Date.now()}`);
        console.log(`✅ Metadata IPFS URI: ${uri}`);
      } catch (e) {
        console.error('❌ Lỗi upload JSON lên Pinata:', e.message);
        throw e;
      }
      console.log('');

      console.log('Tạo collection transaction...');
      const name = 'Boomplay Governance Collection';
      const symbol = 'BPC';

      const tx = await governanceSDK.createCollection(name, symbol, uri, adminPubkey);

      const { blockhash } = await connection.getRecentBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = adminPubkey;

      tx.sign(adminKeypair);
      console.log('Gửi transaction...');
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      console.log(`✓ Transaction signature: ${signature}`);
      console.log('Đợi confirmation...');

      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✓ Collection đã được tạo thành công!');
      console.log('');

      const updatedGovernance = await governanceSDK.fetchGovernance();
      const updatedCollectionMint = updatedGovernance.collectionMint
        ? (updatedGovernance.collectionMint.toBase58 ? updatedGovernance.collectionMint.toBase58() : updatedGovernance.collectionMint)
        : null;
      console.log('Governance sau khi tạo:');
      console.log(`  Collection Mint: ${updatedCollectionMint}`);
      console.log(`  Match với PDA: ${updatedCollectionMint === collectionMintPDA.toBase58() ? '✓' : '✗'}`);
    } else {
      console.log('✓ Collection đã tồn tại!');
      console.log(`   Collection Mint: ${collectionMint}`);
    }

    console.log('\n✓ Hoàn tất!');
  } catch (error) {
    console.error('✗ Lỗi:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkAndCreateCollection();

