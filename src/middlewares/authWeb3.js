const bs58 = require('bs58');
const nacl = require('tweetnacl');
const jwt = require('jsonwebtoken');
const { Member } = require('../database/client');
const { err } = require('../utils/responses');
const AuthenticationInvalid = require('../exceptions/AuthenticationInvalid');
const validateWalletAddress = require('../validates/walletAddress');
const MemberNotFound = require('../exceptions/MemberNotFound');

function verifySolanaSignature(message, signatureBase64, walletAddressBase58) {
  try {
    const messageBytes = Buffer.from(message, 'utf8');
    const signature = Buffer.from(signatureBase64, 'base64');
    const publicKey = bs58.decode(walletAddressBase58);
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch (_) {
    return false;
  }
}

function extractWalletFromMessage(message) {
  // FE formats message as ${address}-${timestamp}
  if (typeof message !== 'string') return '';
  const idx = message.indexOf('-');
  return idx > 0 ? message.slice(0, idx) : '';
}

// Middleware for admin authentication
const adminAuth = async (req, res, next) => {
  try {
    // Prefer JWT if provided
    const bearer = req.headers['authorization'];
    if (bearer && bearer.startsWith('Bearer ')) {
      try {
        const token = bearer.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const wallet_address = validateWalletAddress(payload.wallet_address);
        const checkAdminMember = await Member.MustGet(wallet_address);
        if (checkAdminMember.role !== 'ADMIN') throw new AuthenticationInvalid('Admin access required');
        req.adminMember = checkAdminMember;
        return next();
      } catch (e) {
        // fall through to signature auth
      }
    }
    const message = req.headers['x-auth-message'];
    const signature = req.headers['x-auth-signature'];

    if (!message || !signature || message.trim() === '' || signature.trim() === '') {
      console.error('[adminAuth] Missing or empty auth headers:', { 
        hasMessage: !!message, 
        hasSignature: !!signature,
        messageLength: message?.length || 0,
        signatureLength: signature?.length || 0,
        message: message?.substring(0, 50),
        signature: signature?.substring(0, 20),
        allHeaders: Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth') || h.toLowerCase().includes('x-'))
      });
      return res.status(403).json(err(new AuthenticationInvalid('No authentication data provided')));
    }

    const walletFromMsg = extractWalletFromMessage(message);
    const wallet_address = validateWalletAddress(walletFromMsg);

    const ok = verifySolanaSignature(message, signature, wallet_address);
    if (!ok) {
      console.error('[adminAuth] Invalid signature:', { wallet_address, message: message.substring(0, 50) });
      throw new AuthenticationInvalid('Invalid signature');
    }

    const checkAdminMember = await Member.MustGet(wallet_address);
    if (checkAdminMember.role !== 'ADMIN') {
      console.error('[adminAuth] User is not ADMIN:', { wallet_address, role: checkAdminMember.role });
      throw new AuthenticationInvalid('Admin access required');
    }
    req.adminMember = checkAdminMember;
    next();
  } catch (error) {
    console.error('[adminAuth] Error:', error.message, error.stack);
    if (error instanceof MemberNotFound) {
      error.message = 'Signature or message might wrong that Admin not found';
      return res.status(403).json(err(error));
    } 
    return res.status(403).json(err(error));
  }
};

const memberAuth = async (req, res, next) => {
  try {
    // Prefer JWT if provided
    const bearer = req.headers['authorization'];
    if (bearer && bearer.startsWith('Bearer ')) {
      try {
        const token = bearer.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const wallet_address = validateWalletAddress(payload.wallet_address);
        await Member.MustGet(wallet_address);
        return next();
      } catch (e) {
        // fall through to signature auth
      }
    }
    const message = req.headers['x-auth-message'];
    const signature = req.headers['x-auth-signature'];

    if (!message || !signature) {
      throw new AuthenticationInvalid('No authentication data provided');
    }

    const walletFromMsg = extractWalletFromMessage(message);
    const wallet_address = validateWalletAddress(walletFromMsg);

    const ok = verifySolanaSignature(message, signature, wallet_address);
    if (!ok) throw new AuthenticationInvalid('Invalid signature');

    await Member.MustGet(wallet_address);
    next();
  } catch (error) {
    if (error instanceof MemberNotFound) {
      error.message = 'Signature or message might wrong that Member not found';
      res.status(403).json(err(error));
    } else res.status(403).json(err(error));
  }
};

module.exports = { adminAuth, memberAuth };