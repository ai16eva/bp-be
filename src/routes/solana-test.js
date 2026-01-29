const express = require('express');
const router = express.Router();
const { 
  testSolanaConnection, 
  testSolanaSDKs, 
  quickHealthCheck,
  getSolanaConfig,
  getSolanaPrograms
} = require('../config/solana');
const { err, success } = require('../utils/responses');

/**
 * Test Solana connection health
 * GET /solana-test/health
 */
router.get('/health', async (req, res) => {
  try {
    const result = await quickHealthCheck();
    res.status(200).json(success(result));
  } catch (error) {
    res.status(500).json(err(error));
  }
});

/**
 * Test Solana connection details
 * GET /solana-test/connection
 */
router.get('/connection', async (req, res) => {
  try {
    const result = await testSolanaConnection();
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(success(result));
  } catch (error) {
    res.status(500).json(err(error));
  }
});

/**
 * Test Solana SDKs initialization
 * GET /solana-test/sdks
 */
router.get('/sdks', async (req, res) => {
  try {
    const result = await testSolanaSDKs();
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(success(result));
  } catch (error) {
    res.status(500).json(err(error));
  }
});

/**
 * Get Solana configuration
 * GET /solana-test/config
 */
router.get('/config', async (req, res) => {
  try {
    const config = getSolanaConfig();
    const programs = getSolanaPrograms();
    
    // Remove sensitive information
    const safeConfig = {
      network: config.network,
      rpcUrl: config.rpcUrl,
      wsUrl: config.wsUrl,
      commitment: config.commitment,
      programs: Object.keys(programs).reduce((acc, key) => {
        acc[key] = programs[key] ? programs[key].toString() : null;
        return acc;
      }, {}),
      hasWallets: {
        master: !!config.wallets.master,
        master2: !!config.wallets.master2
      }
    };
    
    res.status(200).json(success(safeConfig));
  } catch (error) {
    res.status(500).json(err(error));
  }
});

/**
 * Run comprehensive Solana tests
 * GET /solana-test/full
 */
router.get('/full', async (req, res) => {
  try {
    const { runSolanaTests } = require('../utils/solana-test');
    const result = await runSolanaTests();
    const statusCode = result.overall ? 200 : 500;
    res.status(statusCode).json(success(result));
  } catch (error) {
    res.status(500).json(err(error));
  }
});

module.exports = router;
