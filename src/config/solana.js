require('dotenv').config();
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

let BPMarketSDK, GovernanceSDK;

try {
  const BPMarketModule = require('../solana-sdk/dist/BPMarket');
  const GovernanceModule = require('../solana-sdk/dist/Governance');
  BPMarketSDK = BPMarketModule.BPMarketSDK;
  GovernanceSDK = GovernanceModule.GovernanceSDK;
} catch (error) {
  console.warn('  Solana SDKs not available (TypeScript files need compilation)');
  console.warn('   To use Solana SDKs, compile TypeScript files first:');
  console.warn('   cd src/solana-sdk && npx tsc');

  BPMarketSDK = class {
    constructor() { throw new Error('BPMarketSDK not available - compile TypeScript first'); }
  };
  GovernanceSDK = class {
    constructor() { throw new Error('GovernanceSDK not available - compile TypeScript first'); }
  };
}

const solanaConfig = {
  dev: {
    network: process.env.SOLANA_NETWORK_DEV || 'devnet',
    rpcUrl: process.env.SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com',
    wsUrl: process.env.SOLANA_WS_URL_DEV || 'wss://api.devnet.solana.com',
    commitment: process.env.SOLANA_COMMITMENT_DEV || 'confirmed',
    programs: {
      bpMarket: process.env.SOLANA_BP_MARKET_PROGRAM_DEV,
      governance: process.env.SOLANA_GOVERNANCE_PROGRAM_DEV,
    },
    wallets: {
      master: process.env.SOLANA_MASTER_WALLET_DEV,
      master2: process.env.SOLANA_MASTER_WALLET2_DEV,
    }
  },
  test: {
    network: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    wsUrl: 'wss://api.devnet.solana.com',
    commitment: 'confirmed',
    programs: {
      bpMarket: '',
      governance: '',
    },
    wallets: {
      master: '',
      master2: '',
    }
  },
  prod: {
    network: process.env.SOLANA_NETWORK || 'mainnet-beta',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
    commitment: process.env.SOLANA_COMMITMENT || 'confirmed',
    programs: {
      bpMarket: process.env.SOLANA_BP_MARKET_PROGRAM,
      governance: process.env.SOLANA_GOVERNANCE_PROGRAM,
    },
    wallets: {
      master: process.env.SOLANA_MASTER_WALLET,
      master2: process.env.SOLANA_MASTER_WALLET2,
    }
  }
};

function getSolanaConfig() {
  const env = process.env.NODE_ENV || 'dev';
  return solanaConfig[env];
}

function createSolanaConnection() {
  const config = getSolanaConfig();
  return new Connection(config.rpcUrl, {
    commitment: config.commitment,
    wsEndpoint: config.wsUrl,
  });
}

function getSolanaWallet(privateKeyString) {
  if (!privateKeyString) {
    throw new Error('Solana wallet private key not provided');
  }

  try {
    const privateKeyArray = JSON.parse(privateKeyString);
    return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
  } catch (error) {
    throw new Error(`Invalid Solana wallet private key format: ${error.message}`);
  }
}

function getSolanaPrograms() {
  const config = getSolanaConfig();
  const programs = {};

  Object.keys(config.programs).forEach(key => {
    const programId = config.programs[key];
    if (programId) {
      try {
        programs[key] = new PublicKey(programId);
      } catch (error) {
        console.warn(`Invalid program ID for ${key}: ${programId}`);
        programs[key] = null;
      }
    } else {
      programs[key] = null;
    }
  });

  return programs;
}

function initializeSolanaSDKs() {
  const connection = createSolanaConnection();
  const programs = getSolanaPrograms();
  const sdks = {};

  if (BPMarketSDK) {
    sdks.bpMarket = new BPMarketSDK(connection);
  }

  if (GovernanceSDK) {
    sdks.governance = new GovernanceSDK(connection);
  }

  return sdks;
}

async function testSolanaConnection() {
  try {
    const connection = createSolanaConnection();
    const config = getSolanaConfig();

    console.log(`Testing Solana connection to ${config.network}...`);
    console.log(`RPC URL: ${config.rpcUrl}`);

    const version = await connection.getVersion();
    console.log(`  Solana connection successful!`);
    console.log(`Solana version: ${version['solana-core']}`);

    const { blockhash } = await connection.getRecentBlockhash();
    console.log(`Recent blockhash: ${blockhash}`);

    const slot = await connection.getSlot();
    console.log(`Current slot: ${slot}`);

    return {
      success: true,
      version: version['solana-core'],
      blockhash,
      slot,
      network: config.network,
      rpcUrl: config.rpcUrl
    };
  } catch (error) {
    console.error(' Solana connection failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function testSolanaSDKs() {
  try {
    console.log('Testing Solana SDKs initialization...');

    const sdks = initializeSolanaSDKs();
    const config = getSolanaConfig();
    const programs = getSolanaPrograms();

    const results = {};

    // Test each SDK
    Object.keys(sdks).forEach(sdkName => {
      try {
        const sdk = sdks[sdkName];
        const programId = programs[sdkName];

        if (sdk && programId) {
          console.log(`  ${sdkName} SDK initialized successfully`);
          console.log(`   Program ID: ${programId.toString()}`);
          results[sdkName] = {
            success: true,
            programId: programId.toString()
          };
        } else {
          console.log(`  ${sdkName} SDK skipped (no program ID)`);
          results[sdkName] = {
            success: false,
            error: 'No program ID provided'
          };
        }
      } catch (error) {
        console.error(` ${sdkName} SDK initialization failed:`, error.message);
        results[sdkName] = {
          success: false,
          error: error.message
        };
      }
    });

    return {
      success: true,
      sdks: results,
      config: {
        network: config.network,
        rpcUrl: config.rpcUrl
      }
    };
  } catch (error) {
    console.error(' Solana SDKs test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

function getBPMarketSDK() {
  const sdks = initializeSolanaSDKs();
  if (!sdks.bpMarket) {
    throw new Error('BPMarketSDK not available - compile TypeScript first');
  }
  return sdks.bpMarket;
}

function getGovernanceSDK() {
  const sdks = initializeSolanaSDKs();
  if (!sdks.governance) throw new Error('GovernanceSDK not available - compile TypeScript first');
  return sdks.governance;
}

if (process.env.SOLANA_VALIDATE_ON_START === '1') {
  try {
    const { validateSolanaConfig } = require('../utils/solanaConfigValidation');
    const validationResult = validateSolanaConfig(null, false); // Non-strict mode
    if (!validationResult.valid) {
      console.warn('  Solana configuration validation failed:');
      validationResult.missing.forEach(key => {
        console.warn(`   Missing required: ${key}`);
      });
    }
  } catch (error) {
    console.warn('  Solana configuration validation error:', error.message);
  }
}

module.exports = {
  getSolanaConfig,
  createSolanaConnection,
  getSolanaWallet,
  getSolanaPrograms,
  initializeSolanaSDKs,
  testSolanaConnection,
  testSolanaSDKs,
  getBPMarketSDK,
  getGovernanceSDK,
  solanaConfig
};

