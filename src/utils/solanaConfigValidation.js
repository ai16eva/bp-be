const { PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');


const REQUIRED_ENV_VARS = {
  dev: [
    'SOLANA_RPC_URL_DEV',
    'SOLANA_GOVERNANCE_PROGRAM_DEV',
    'SOLANA_MASTER_WALLET_PRIVATE_KEY',
  ],
  test: [
    'SOLANA_RPC_URL_DEV',
    'SOLANA_MASTER_WALLET_PRIVATE_KEY',
  ],
  prod: [
    'SOLANA_RPC_URL',
    'SOLANA_GOVERNANCE_PROGRAM',
    'SOLANA_MASTER_WALLET_PRIVATE_KEY',
  ],
};

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = {
  dev: [
    'SOLANA_BP_MARKET_PROGRAM_DEV',
    'SOLANA_MASTER_WALLET_DEV',
  ],
  test: [
    'SOLANA_MASTER_WALLET_DEV',
  ],
  prod: [
    'SOLANA_BP_MARKET_PROGRAM',
    'SOLANA_MASTER_WALLET',
  ],
};

/**
 * Validate Solana configuration
 * @param {string} env - Environment (dev/test/prod)
 * @param {boolean} strict - If true, throw error on missing vars (default: false)
 * @returns {object} Validation result
 */
function validateSolanaConfig(env = null, strict = false) {
  const currentEnv = env || process.env.NODE_ENV || 'dev';
  const required = REQUIRED_ENV_VARS[currentEnv] || REQUIRED_ENV_VARS.dev;
  const recommended = RECOMMENDED_ENV_VARS[currentEnv] || RECOMMENDED_ENV_VARS.dev;

  const missing = [];
  const missingRecommended = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const key of recommended) {
    if (!process.env[key]) {
      missingRecommended.push(key);
    }
  }

  const result = {
    valid: missing.length === 0,
    env: currentEnv,
    missing,
    missingRecommended,
    warnings: [],
  };

  if (missingRecommended.length > 0) {
    result.warnings.push(
      `Missing recommended environment variables: ${missingRecommended.join(', ')}`
    );
  }

  const validationErrors = validateEnvVarFormats(currentEnv);
  if (validationErrors.length > 0) {
    result.warnings.push(...validationErrors);
  }

  if (strict && missing.length > 0) {
    throw new Error(
      `Missing required Solana environment variables for ${currentEnv}: ${missing.join(', ')}`
    );
  }

  return result;
}

/**
 * Validate format of environment variables
 * @param {string} env - Environment
 * @returns {Array<string>} Array of validation error messages
 */
function validateEnvVarFormats(env) {
  const errors = [];

  // Validate RPC URL format
  const rpcUrlKey = env === 'prod' ? 'SOLANA_RPC_URL' : 'SOLANA_RPC_URL_DEV';
  const rpcUrl = process.env[rpcUrlKey];
  if (rpcUrl && !rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    errors.push(`${rpcUrlKey} should be a valid HTTP/HTTPS URL`);
  }

  // Validate program IDs (PublicKey format)
  const programKeys = [
    'SOLANA_GOVERNANCE_PROGRAM',
    'SOLANA_BP_MARKET_PROGRAM',
  ].map(key => env === 'prod' ? key : `${key}_DEV`);

  for (const key of programKeys) {
    const value = process.env[key];
    if (value) {
      try {
        new PublicKey(value);
      } catch (error) {
        errors.push(`${key} is not a valid Solana PublicKey: ${error.message}`);
      }
    }
  }

  // Validate wallet addresses
  const walletKeys = [
    'SOLANA_MASTER_WALLET',
    'SOLANA_MASTER_WALLET2',
  ].map(key => env === 'prod' ? key : `${key}_DEV`);

  for (const key of walletKeys) {
    const value = process.env[key];
    if (value) {
      try {
        new PublicKey(value);
      } catch (error) {
        errors.push(`${key} is not a valid Solana PublicKey: ${error.message}`);
      }
    }
  }

  // Validate private key format
  const privateKeyKey = 'SOLANA_MASTER_WALLET_PRIVATE_KEY';
  const privateKey = process.env[privateKeyKey];
  if (privateKey) {
    try {
      // Try to parse as JSON array
      JSON.parse(privateKey);
    } catch (jsonError) {
      try {
        // Try as base58
        bs58.decode(privateKey);
      } catch (base58Error) {
        errors.push(
          `${privateKeyKey} should be either a JSON array or base58 encoded string`
        );
      }
    }
  }

  return errors;
}

/**
 * Print validation results
 * @param {object} validationResult - Result from validateSolanaConfig
 */
function printValidationResults(validationResult) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 Solana Configuration Validation');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Environment: ${validationResult.env}`);
  console.log(`Status: ${validationResult.valid ? '  Valid' : ' Invalid'}`);

  if (validationResult.missing.length > 0) {
    console.log('\n Missing required variables:');
    validationResult.missing.forEach(key => {
      console.log(`   - ${key}`);
    });
  }

  if (validationResult.missingRecommended.length > 0) {
    console.log('\n  Missing recommended variables:');
    validationResult.missingRecommended.forEach(key => {
      console.log(`   - ${key}`);
    });
  }

  if (validationResult.warnings.length > 0) {
    console.log('\n  Warnings:');
    validationResult.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }

  if (validationResult.valid && validationResult.warnings.length === 0) {
    console.log('\n  All configuration is valid!');
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * Validate and print results (convenience function)
 * @param {string} env - Environment
 * @param {boolean} strict - Strict mode
 */
function validateAndPrint(env = null, strict = false) {
  const result = validateSolanaConfig(env, strict);
  printValidationResults(result);
  return result;
}

module.exports = {
  validateSolanaConfig,
  validateEnvVarFormats,
  printValidationResults,
  validateAndPrint,
  REQUIRED_ENV_VARS,
  RECOMMENDED_ENV_VARS,
};


