const { s3Upload } = require('../utils/upload/uploadToAws');
const { err, success } = require('../utils/responses');
const client = require('../database/client');

const validateWalletAddress = require('../validates/walletAddress');
const validateTransactionHash = require('../validates/txHash');
const validateEmail = require('../validates/emailAddress');
const validateRole = require('../validates/memberRole');
const validateName = require('../validates/memberName');

const env = process.env.NODE_ENV || 'dev';
const config = require('../config/contract');
let { owner2 } = config[env];

const { isAdmin } = require('../validates/isAdmin');
const ContractInteractionError = require('../exceptions/ContractInteractionError');
const { logger } = require("sequelize/lib/utils/logger");
const { getSolanaService } = require('../services/solanaService');
const googleSheetService = require('../services/googleSheetService');
const jwt = require('jsonwebtoken');
const bs58 = require('bs58');
const nacl = require('tweetnacl');

module.exports = {
  loginSolana: async (req, res) => {
    try {
      const message = req.headers['x-auth-message'];
      const signatureBase64 = req.headers['x-auth-signature'];
      if (!message || !signatureBase64) {
        return res.status(400).json(err(new Error('No authentication data provided')));
      }

      const extractWalletFromMessage = (msg) => {
        if (typeof msg !== 'string') return '';
        const idx = msg.indexOf('-');
        return idx > 0 ? msg.slice(0, idx) : '';
      };

      const walletFromMsg = extractWalletFromMessage(message);
      const wallet_address = validateWalletAddress(walletFromMsg);

      const ok = (() => {
        try {
          const messageBytes = Buffer.from(message, 'utf8');
          const signature = Buffer.from(signatureBase64, 'base64');
          const publicKey = bs58.decode(wallet_address);
          return nacl.sign.detached.verify(messageBytes, signature, publicKey);
        } catch (_) {
          return false;
        }
      })();

      if (!ok) {
        return res.status(403).json(err(new Error('Invalid signature')));
      }

      const member = await client.Member.MustGet(wallet_address);
      const token = jwt.sign(
        { wallet_address, role: member.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.status(200).json(success({ token }));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      return res.status(errorCode).json(err(e));
    }
  },
  createMember: async (req, res) => {
    try {
      let { wallet_address } = req.body;
      wallet_address = validateWalletAddress(wallet_address);
      await client.Member.Create(wallet_address);

      res.status(200).json(success());
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },
  createMemberV2: async (req, res) => {
    try {
      let { wallet_address, wallet_type } = req.body;
      let referral = req.query.referral;
      wallet_address = validateWalletAddress(wallet_address);
      const normalizedType = typeof wallet_type === 'string' && wallet_type.trim()
        ? wallet_type.trim().toUpperCase()
        : 'UNKNOWN';
      await client.Member.CreateV2(wallet_address, normalizedType);
      try {
        await client.ActivityRewardActions.createActivityReward(wallet_address, 140, "SIGNUP");
      } catch (e) {
        const { storeFailedTransaction } = require('../utils/failedTransactionQueue');
        await storeFailedTransaction({
          type: 'ACTIVITY_REWARD',
          wallet_address,
          data: {
            reward_amount: 140,
            reward_type: 'SIGNUP',
          },
          error: e,
        });
        logger.error(e);
      }

      await client.Referral.createReferralCode(wallet_address)
      if (referral) {
        await client.Referral.createReferral(wallet_address, referral);
        const referred = await client.ReferralCode.getReferralCode(referral);
        if (referred) {
          try {
            await client.ActivityRewardActions.createActivityReward(referred.wallet_address, 70, "REFERRAL");
          } catch (error) {
            const { storeFailedTransaction } = require('../utils/failedTransactionQueue');
            await storeFailedTransaction({
              type: 'ACTIVITY_REWARD',
              wallet_address: referred.wallet_address,
              data: {
                reward_amount: 70,
                reward_type: 'REFERRAL',
              },
              error: error,
            });
            console.log(error);
          }
        }

      }

      res.status(200).json(success('User registered successfully.'));
    } catch (e) {
      console.log(e)
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  getMember: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      wallet_address = validateWalletAddress(wallet_address);

      const member = await client.Member.MustGet(wallet_address);

      res.status(200).json(success(member));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  updateMember: async (req, res) => {
    try {
      let { name, email } = req.body;
      let wallet_address = req.params.wallet_address;

      wallet_address = validateWalletAddress(wallet_address);
      if (email) {
        validateEmail(email);
      }
      if (name !== undefined && name !== null) {
        name = validateName(name, { allowEmpty: true });
      }
      let updateInfo = { email, name };
      if (req.file) {
        const avatar = await s3Upload(req.file);
        updateInfo['avatar'] = avatar;
      }

      await client.Member.Update(wallet_address, updateInfo);
      res.status(200).json(success());
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },
  updateMemberRole: async (req, res) => {
    try {
      isAdmin(req.adminMember);

      let { role, wallet_address } = req.body;
      wallet_address = validateWalletAddress(wallet_address);
      role = validateRole(role);

      await client.Member.UpdateRole(wallet_address, role);
      res.status(200).json(success('', 'Updated!'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },
  lockMember: async (req, res) => {
    let { wallet_address } = req.body;
    let receipt;
    try {
      wallet_address = validateWalletAddress(wallet_address);
      await client.Member.MustGet(wallet_address);
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      return res.status(errorCode).json(err(e));
    }

    try {
      const solanaService = getSolanaService();
      const result = await solanaService.lockUser(wallet_address, owner2);

      if (!result.success) {
        return res.status(400).json(err(new ContractInteractionError(result.error)));
      }

      receipt = result.transaction;
    } catch (e) {
      // Handle timeout/blockhash expiration similar to questDaoController
      const { handleSolanaError } = require('../utils/solanaErrorHandler');
      const errorInfo = handleSolanaError(e);

      if (e.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          const txHash = e.transactionHash || errorInfo.originalError?.transactionHash || receipt?.signature;
          if (txHash) {
            console.warn(`Lock transaction timeout for ${wallet_address}: ${txHash}`);
          }
        } catch (dbError) {
          console.warn(`Failed to handle timeout for lock ${wallet_address}:`, dbError);
        }
        return res.status(202).json(success('', 'Pending'));
      }

      return res.status(400).json(err(new ContractInteractionError(e.message)));
    }

    try {
      await client.Member.Lock(wallet_address);
      return res.status(200).json(success('', 'Locked!'));
    } catch (e) {
      console.warn(`Database update failed ${wallet_address} to Lock : ${e}`);
      return res.status(202).json(success('', 'Transaction success but DB Update Failed'));
    }
  },
  /**
   * Unlock member on Solana blockchain
   */
  unLockMember: async (req, res) => {
    let { wallet_address } = req.body;
    let receipt;

    try {
      wallet_address = validateWalletAddress(wallet_address);
      await client.Member.MustGet(wallet_address);
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      return res.status(errorCode).json(err(e));
    }

    try {
      const solanaService = getSolanaService();
      const result = await solanaService.unlockUser(wallet_address, owner2);

      if (!result.success) {
        return res.status(400).json(err(new ContractInteractionError(result.error)));
      }

      receipt = result.transaction;
    } catch (e) {
      // Handle timeout/blockhash expiration similar to questDaoController
      const { handleSolanaError } = require('../utils/solanaErrorHandler');
      const errorInfo = handleSolanaError(e);

      if (e.message === 'Transaction timeout' || errorInfo.name === 'BlockhashExpired') {
        try {
          const txHash = e.transactionHash || errorInfo.originalError?.transactionHash || receipt?.signature;
          if (txHash) {
            console.warn(`Unlock transaction timeout for ${wallet_address}: ${txHash}`);
          }
        } catch (dbError) {
          console.warn(`Failed to handle timeout for unlock ${wallet_address}:`, dbError);
        }
        return res.status(202).json(success('', 'Pending'));
      }

      return res.status(400).json(err(new ContractInteractionError(e.message)));
    }

    try {
      await client.Member.Unlock(wallet_address);
      return res.status(200).json(success('', 'Unlocked!'));
    } catch (e) {
      console.warn(`Database update failed ${wallet_address} to Unlock : ${e}`);
      return res.status(202).json(success('', 'Transaction success but DB Update Failed'));
    }
  },

  archiveMember: async (req, res) => {
    try {
      let { wallet_address } = req.body;
      wallet_address = validateWalletAddress(wallet_address);
      await client.Member.Archive(wallet_address);
      res.status(200).json(success('', 'Archived!'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  unArchiveMember: async (req, res) => {
    try {
      let { wallet_address } = req.body;
      wallet_address = validateWalletAddress(wallet_address);
      await client.Member.Unarchive(wallet_address);
      res.status(200).json(success('', 'unArchived!'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  updateMemberDelegate: async (req, res) => {
    try {
      let { delegated_tx } = req.body;
      let wallet_address = req.params.wallet_address;

      validateTransactionHash(delegated_tx);
      wallet_address = validateWalletAddress(wallet_address);

      await client.Member.Delegate(wallet_address, delegated_tx);
      res.status(200).json(success('', 'Delegated!'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  getAllMembers: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 10;
      const members = await client.Member.List(pageSize, page);
      res.status(200).json(success(members, ''));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  deleteMember: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      wallet_address = validateWalletAddress(wallet_address);

      await client.Member.Delete(wallet_address);
      res.status(200).json(success('', 'Deleted !'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  authCheck: async (req, res) => {
    try {
      isAdmin(req.adminMember);
      res.status(200).json(success('', 'Checked!'));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  listVotesByMember: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 50;
      wallet_address = validateWalletAddress(wallet_address);
      const votes = await client.Vote.listVoteByVoter(wallet_address, pageSize, page);
      res.status(200).json(success(votes));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },
  getMyBettings: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.size, 10) || 50;
      validateWalletAddress(wallet_address);
      const bettings = await client.Betting.MyBettings(wallet_address, page, pageSize);
      res.status(200).json(success(bettings));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
  getReferralCode: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      validateWalletAddress(wallet_address);
      const referral = await client.Referral.getReferralCode(wallet_address);
      res.status(200).json(success(referral));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  getCreatorStatus: async (req, res) => {
    try {
      let wallet_address = req.params.wallet_address;
      wallet_address = validateWalletAddress(wallet_address);

      const isCreator = await googleSheetService.isCreator(wallet_address);
      const creatorInfo = isCreator
        ? await googleSheetService.getCreatorInfo(wallet_address)
        : null;

      res.status(200).json(success({
        is_creator: isCreator,
        creator_info: creatorInfo,
      }));
    } catch (e) {
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  }
};
