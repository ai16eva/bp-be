/**
 * Enhanced Solana Error Handler with Anchor error parsing
 */

// Common Anchor error codes mapping
const ANCHOR_ERROR_CODES = {
  '0xbc4': { code: 'AccountNotInitialized', message: 'Account has not been initialized' },
  '0xbc7': { code: 'InvalidAccountData', message: 'Account data is invalid' },
  '0xbc8': { code: 'AccountDiscriminatorMismatch', message: 'Account discriminator mismatch' },
  '0xbc9': { code: 'AccountDiscriminatorNotFound', message: 'Account discriminator not found' },
  '0xbca': { code: 'AccountNotEnoughKeys', message: 'Account does not have enough keys' },
  '0xbcb': { code: 'AccountNotMutable', message: 'Account is not mutable' },
  '0xbcc': { code: 'AccountOwnedByWrongProgram', message: 'Account is owned by wrong program' },
  '0xbd3': { code: 'InvalidProgramData', message: 'Program data is invalid' },
  '0xbd4': { code: 'InsufficientFunds', message: 'Insufficient funds' },
};

/**
 * Parse Anchor error from transaction logs
 * @param {Error} error - Solana error
 * @returns {object} Parsed error information
 */
function parseAnchorError(error) {
  const msg = error?.message || '';
  const logs = error?.logs || [];
  
  // Try to extract Anchor error code from logs
  for (const log of logs) {
    if (typeof log === 'string') {
      // Look for Anchor error pattern: "Program log: AnchorError caused by account: ..."
      const anchorErrorMatch = log.match(/AnchorError caused by account: (\w+).*Error Code: (\w+).*Error Number: (0x[a-fA-F0-9]+)/);
      if (anchorErrorMatch) {
        const [, account, errorCode, errorNumber] = anchorErrorMatch;
        const anchorError = ANCHOR_ERROR_CODES[errorNumber];
        if (anchorError) {
          return {
            name: 'AnchorError',
            code: anchorError.code,
            number: errorNumber,
            account: account,
            message: `${anchorError.message} (account: ${account})`,
            solanaError: true,
            anchorError: true,
            logs: logs,
          };
        }
        
        return {
          name: 'AnchorError',
          code: errorCode,
          number: errorNumber,
          account: account,
          message: `Anchor error: ${errorCode} on account ${account}`,
          solanaError: true,
          anchorError: true,
          logs: logs,
        };
      }
      
      // Look for program error code
      const programErrorMatch = log.match(/custom program error: (0x[a-fA-F0-9]+)/);
      if (programErrorMatch) {
        const errorNumber = programErrorMatch[1];
        const anchorError = ANCHOR_ERROR_CODES[errorNumber];
        if (anchorError) {
          return {
            name: 'AnchorError',
            code: anchorError.code,
            number: errorNumber,
            message: anchorError.message,
            solanaError: true,
            anchorError: true,
            logs: logs,
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Handle Solana errors with enhanced parsing
 * @param {Error} error - Solana error
 * @returns {object} Formatted error object
 */
function handleSolanaError(error) {
  console.error('Solana Error:', error);

  const msg = error?.message || '';
  const logs = error?.logs || [];

  // First, try to parse Anchor error
  const anchorError = parseAnchorError(error);
  if (anchorError) {
    return anchorError;
  }

  // Common error patterns
  if (msg.includes('Account does not exist') || msg.includes('AccountNotFound')) {
    return {
      name: 'AccountNotFound',
      message: 'Account does not exist on-chain',
      solanaError: true,
      logs: logs,
    };
  }

  if (msg.includes('Transaction simulation failed')) {
    // Try to extract more details from logs
    let detailedMessage = 'Transaction would fail. Check account balances and permissions.';
    
    // Look for specific failure reasons in logs
    for (const log of logs) {
      if (typeof log === 'string') {
        if (log.includes('insufficient')) {
          detailedMessage = 'Insufficient funds for transaction';
          break;
        }
        if (log.includes('AccountNotInitialized')) {
          detailedMessage = 'Required account has not been initialized';
          break;
        }
        if (log.includes('ConstraintViolation')) {
          detailedMessage = 'Account constraint violation';
          break;
        }
      }
    }
    
    return {
      name: 'TransactionSimulationFailed',
      message: detailedMessage,
      solanaError: true,
      logs: logs,
    };
  }

  if (msg.includes('insufficient') || msg.includes('Insufficient')) {
    return {
      name: 'InsufficientFunds',
      message: 'Insufficient SOL or token balance',
      solanaError: true,
      logs: logs,
    };
  }

  if (msg.includes('block height exceeded') || msg.includes('Blockhash not found')) {
    return {
      name: 'BlockhashExpired',
      message: 'Transaction blockhash expired. Please retry with new blockhash.',
      solanaError: true,
      retryable: true,
      logs: logs,
    };
  }

  if (msg.includes('locked') || msg.includes('Locked')) {
    return {
      name: 'UserLocked',
      message: 'This wallet address is locked and cannot perform operations',
      solanaError: true,
      logs: logs,
    };
  }

  // Program errors
  if (msg.includes('custom program error')) {
    const errorCodeMatch = msg.match(/custom program error: (0x[a-fA-F0-9]+)/);
    if (errorCodeMatch) {
      const errorNumber = errorCodeMatch[1];
      const anchorError = ANCHOR_ERROR_CODES[errorNumber];
      if (anchorError) {
        return {
          name: 'ProgramError',
          code: anchorError.code,
          number: errorNumber,
          message: anchorError.message,
          solanaError: true,
          logs: logs,
        };
      }
    }
    
    return {
      name: 'ProgramError',
      message: 'Smart contract program error occurred',
      solanaError: true,
      logs: logs,
    };
  }

  // Signature errors
  if (msg.includes('signature') || msg.includes('Signature')) {
    return {
      name: 'SignatureError',
      message: 'Transaction signature error',
      solanaError: true,
      logs: logs,
    };
  }

  // Network errors
  if (msg.includes('ECONNREFUSED') || msg.includes('network') || msg.includes('timeout')) {
    return {
      name: 'NetworkError',
      message: 'Network connection error. Please check your connection and retry.',
      solanaError: true,
      retryable: true,
      logs: logs,
    };
  }

  return {
    name: error.name || 'SolanaError',
    message: msg || 'An unknown error occurred with Solana',
    solanaError: true,
    logs: logs,
    originalError: error,
  };
}

module.exports = {
  handleSolanaError,
  parseAnchorError,
  ANCHOR_ERROR_CODES,
};
