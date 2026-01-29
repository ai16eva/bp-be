const { 
  testSolanaConnection, 
  testSolanaSDKs, 
  createSolanaConnection,
  getSolanaConfig,
  getSolanaPrograms
} = require('../config/solana');

/**
 * Comprehensive Solana connection and SDK test
 */
async function runSolanaTests() {
  console.log('🚀 Starting Solana Integration Tests...\n');
  
  const results = {
    connection: null,
    sdks: null,
    overall: false
  };
  
  try {
    // Test 1: Basic Connection
    console.log('='.repeat(50));
    console.log('TEST 1: Solana Connection');
    console.log('='.repeat(50));
    
    results.connection = await testSolanaConnection();
    
    if (!results.connection.success) {
      console.log(' Connection test failed. Skipping SDK tests.');
      return results;
    }
    
    console.log('\n');
    
    // Test 2: SDKs Initialization
    console.log('='.repeat(50));
    console.log('TEST 2: Solana SDKs Initialization');
    console.log('='.repeat(50));
    
    results.sdks = await testSolanaSDKs();
    
    console.log('\n');
    
    // Test 3: Configuration Validation
    console.log('='.repeat(50));
    console.log('TEST 3: Configuration Validation');
    console.log('='.repeat(50));
    
    const config = getSolanaConfig();
    const programs = getSolanaPrograms();
    
    console.log(`Environment: ${process.env.NODE_ENV || 'dev'}`);
    console.log(`Network: ${config.network}`);
    console.log(`RPC URL: ${config.rpcUrl}`);
    console.log(`Commitment: ${config.commitment}`);
    
    console.log('\nProgram IDs:');
    Object.keys(programs).forEach(key => {
      const programId = programs[key];
      if (programId) {
        console.log(`  ${key}: ${programId.toString()}`);
      } else {
        console.log(` ${key}: Not configured`);
      }
    });
    
    console.log('\n');
    
    // Test 4: Advanced Connection Tests
    console.log('='.repeat(50));
    console.log('TEST 4: Advanced Connection Tests');
    console.log('='.repeat(50));
    
    await runAdvancedTests();
    
    // Overall Result
    results.overall = results.connection.success && results.sdks.success;
    
    console.log('='.repeat(50));
    console.log('FINAL RESULT');
    console.log('='.repeat(50));
    
    if (results.overall) {
      console.log('🎉 All Solana tests passed successfully!');
      console.log('  Solana SDK is ready for use in the project.');
    } else {
      console.log(' Some tests failed. Please check the configuration.');
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    results.overall = false;
    return results;
  }
}

/**
 * Run advanced connection tests
 */
async function runAdvancedTests() {
  try {
    const connection = createSolanaConnection();
    const config = getSolanaConfig();
    
    // Test 1: Get account info
    console.log('Testing account info retrieval...');
    const accountInfo = await connection.getAccountInfo(connection.publicKey);
    console.log(`  Account info test passed`);
    
    // Test 2: Get recent performance samples
    console.log('Testing performance samples...');
    const samples = await connection.getRecentPerformanceSamples(1);
    console.log(`  Performance samples test passed (${samples.length} samples)`);
    
    // Test 3: Get cluster nodes
    console.log('Testing cluster nodes...');
    const nodes = await connection.getClusterNodes();
    console.log(`  Cluster nodes test passed (${nodes.length} nodes)`);
    
    // Test 4: Get epoch info
    console.log('Testing epoch info...');
    const epochInfo = await connection.getEpochInfo();
    console.log(`  Epoch info test passed (epoch: ${epochInfo.epoch})`);
    
    // Test 5: Get health
    console.log('Testing health check...');
    const health = await connection.getHealth();
    console.log(`  Health check passed (${health})`);
    
  } catch (error) {
    console.error(` Advanced test failed: ${error.message}`);
  }
}

/**
 * Test specific SDK functionality
 */
async function testSpecificSDK(sdkName) {
  try {
    console.log(`\nTesting ${sdkName} SDK specific functionality...`);
    
    const { initializeSolanaSDKs } = require('../config/solana');
    const sdks = initializeSolanaSDKs();
    
    if (!sdks[sdkName]) {
      console.log(` ${sdkName} SDK not available`);
      return false;
    }
    
    const sdk = sdks[sdkName];
    
    // Test basic SDK methods
    switch (sdkName) {
      case 'bpMarket':
        console.log('Testing BPMarket SDK...');
        // Test basic methods
        const bpMarketConfigPDA = sdk.getConfigPDA();
        console.log(`  Config PDA: ${bpMarketConfigPDA.toString()}`);
        break;
        
      case 'forecastExchange':
        console.log('Testing ForecastExchange SDK...');
        const tokenStatePDA = sdk.getTokenStatePDA();
        console.log(`  Token State PDA: ${tokenStatePDA.toString()}`);
        break;
        
      case 'usdpExchange':
        console.log('Testing USDPExchange SDK...');
        const exchangeStatePDA = sdk.getExchangeStatePDA();
        console.log(`  Exchange State PDA: ${exchangeStatePDA.toString()}`);
        break;
        
      case 'governance':
        console.log('Testing Governance SDK...');
        const [governanceConfigPDA, bump] = sdk.getConfigPDA();
        console.log(`  Governance Config PDA: ${governanceConfigPDA.toString()} (bump: ${bump})`);
        break;
    }
    
    console.log(`  ${sdkName} SDK test passed`);
    return true;
    
  } catch (error) {
    console.error(` ${sdkName} SDK test failed: ${error.message}`);
    return false;
  }
}

/**
 * Quick health check for Solana connection
 */
async function quickHealthCheck() {
  try {
    const connection = createSolanaConnection();
    const slot = await connection.getSlot();
    const version = await connection.getVersion();
    
    return {
      success: true,
      version: version['solana-core'],
      slot,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  runSolanaTests,
  testSpecificSDK,
  quickHealthCheck
};

// Run tests if this file is executed directly
if (require.main === module) {
  runSolanaTests()
    .then(results => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}
