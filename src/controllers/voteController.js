const { err, success } = require('../utils/responses');
const client = require('../database/client');

const validateTransactionHash = require('../validates/txHash');
const validateWalletAddress = require('../validates/walletAddress');
const { validateVotingPower, validateDraftOp, validateSuccessOp } = require('../validates/enum/voteOptions');
const { getGovernanceSDK } = require('../config/solana');

const { PublicKey } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');

const { convertToBN, convertToPublicKey } = require('../utils/solanaHelpers');
const transactionStatusService = require('../services/transactionStatusService');
const solanaTxService = require('../services/solanaTxService');

// Import improvements
const { handleSolanaError } = require('../utils/solanaErrorHandler');
const { checkAccountBalance } = require('../utils/solanaAccountHelpers');

module.exports = {
  createVote: async (req, res) => {
    try {
      const quest_key = req.params.quest_key;
      let { voter, power, option, tx } = req.body;
      voter = validateWalletAddress(voter);
      validateTransactionHash(tx);

      validateVotingPower(power);
      option = validateDraftOp(option);

      // Enforce on-chain maxVotableNft to avoid oversized power submissions
      const governanceSDK = getGovernanceSDK();
      const cfg = await governanceSDK.fetchConfig();
      const maxVotableNft = Number(cfg?.maxVotableNft ?? 0);
      if (Number.isFinite(maxVotableNft) && maxVotableNft > 0 && power > maxVotableNft) {
        power = maxVotableNft;
      }

      const data = {
        voter,
        power,
        option,
        tx,
      };

      await client.Vote.Create(quest_key, data);
      res.status(200).json(success());
    } catch (e) {
      console.error('Create vote error:', e);
      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },

  updateVoteSuccess: async (req, res) => {
    try {
      let { quest_key, voter } = req.params;
      let { option, tx } = req.body;
      voter = validateWalletAddress(voter);
      validateTransactionHash(tx);
      option = validateSuccessOp(option);

      const data = { option, tx };
      await client.Vote.UpdateSuccess(quest_key, voter, data);

      res.status(200).json(success());
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },

  updateVoteAnswer: async (req, res) => {
    try {
      let { quest_key, voter } = req.params;
      let { answer_key, tx } = req.body;

      voter = validateWalletAddress(voter);
      validateTransactionHash(tx);
      const data = { answer_key, tx };
      await client.Vote.UpdateAnswer(quest_key, voter, data);

      res.status(200).json(success());
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },

  updateVoteReward: async (req, res) => {
    try {
      let { quest_key, voter } = req.params;
      const { reward } = req.body;

      voter = validateWalletAddress(voter);
      await client.Vote.UpdateReward(quest_key, voter, reward);

      res.status(200).json(success());
    } catch (e) {

      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },
  //After domain defined
  getVote: async (req, res) => {
    try {
      let { quest_key, voter } = req.params;
      voter = validateWalletAddress(voter);
      const vote = await client.Vote.Get(quest_key, voter);

      res.status(200).json(success(vote));
    } catch (e) {
      // Use improved error handling
      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },

  createGovernanceItem: async (req, res) => {
    try {
      const { quest_key, question, creator, creatorNftAccount } = req.body;

      if (!quest_key || !question || !creator) {
        throw new Error('quest_key, question, and creator are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const creatorPK = convertToPublicKey(creator);
      const creatorNftPK = creatorNftAccount ? convertToPublicKey(creatorNftAccount) : creatorPK;

      const transaction = await governanceSDK.createGovernanceItem(
        questKeyBN,
        question,
        creatorNftPK,
        creatorPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = creatorPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Governance item transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Create governance item error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  listVote: async (req, res) => { },

  archiveVote: async (req, res) => {
    try {
      const { quest_key } = req.params;
      let { voter } = req.body;

      voter = validateWalletAddress(voter);

      await client.Vote.Archive(quest_key, voter);

      res.status(200).json(success());
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      const errorMessage = errorInfo.message || e.message;
      res.status(errorCode).json(err(errorMessage || e));
    }
  },

  unArchiveVote: async (req, res) => {
    try {
      const { quest_key } = req.params;
      let { voter } = req.body;

      voter = validateWalletAddress(voter);

      await client.Vote.Unarchive(quest_key, voter);

      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  setDecisionAndExecuteAnswer: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { answer_keys, authority } = req.body;

      if (!quest_key || !answer_keys || !authority) {
        throw new Error('quest_key, answer_keys, and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const authorityPK = convertToPublicKey(authority);
      const answerKeysBN = answer_keys.map(key => convertToBN(key));

      const transaction = await governanceSDK.setDecisionAndExecuteAnswer(
        questKeyBN,
        answerKeysBN,
        authorityPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Set decision and execute answer transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set decision and execute answer error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setAnswerResult: async (req, res) => {
    try {
      const { quest_key } = req.body; // quest_key từ body, không phải params
      const { answer_keys, authority } = req.body;

      if (!quest_key || !answer_keys || !authority) {
        throw new Error('quest_key, answer_keys, and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const authorityPK = convertToPublicKey(authority);
      const answerKeysBN = answer_keys.map(key => convertToBN(key));

      const transaction = await governanceSDK.setAnswer(
        questKeyBN,
        answerKeysBN,
        authorityPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Set answer result transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set answer result error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  cancelAnswer: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { reason, authority } = req.body;

      if (!quest_key || !reason || !authority) {
        throw new Error('quest_key, reason, and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const authorityPK = convertToPublicKey(authority);

      const transaction = await governanceSDK.cancelAnswer(
        questKeyBN,
        reason,
        authorityPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Cancel answer transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Cancel answer error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  voteDecision: async (req, res) => {
    try {
      const quest_key = req.params.quest_key;
      let { voter, power, option } = req.body;
      voter = validateWalletAddress(voter);

      validateVotingPower(power);
      option = validateSuccessOp(option);

      const existingVote = await client.Vote.Get(quest_key, voter);
      if (!existingVote || !existingVote.vote_draft_option) {
        throw new Error(' must vote draft before');
      }
      if (existingVote.vote_success_option) {
        throw new Error('Already voted on decision');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const voterPK = convertToPublicKey(voter);

      const voteChoice = option === 'SUCCESS' ? 'success' : 'adjourn';

      const transaction = await governanceSDK.voteDecision(
        questKeyBN,
        voteChoice,
        voterPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = voterPK;

      await client.Vote.UpdateSuccess(quest_key, voter, {
        option,
        tx: 'pending',
      });

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Vote decision transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Vote decision error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  // Vote Answer
  voteAnswer: async (req, res) => {
    try {
      const quest_key = req.params.quest_key;
      let { voter, power, answer_key, voterNftAccount } = req.body;
      voter = validateWalletAddress(voter);

      if (!voterNftAccount) {
        throw new Error('voterNftAccount is required for Solana voting');
      }

      if (!answer_key) {
        throw new Error('answer_key is required');
      }

      validateVotingPower(power);

      const existingVote = await client.Vote.Get(quest_key, voter);
      if (!existingVote || !existingVote.vote_success_option) {
        throw new Error('Phải vote vòng decision trước');
      }
      if (existingVote.quest_answer_key) {
        throw new Error('Đã vote vòng answer');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const voterPK = convertToPublicKey(voter);
      const voterNftPK = convertToPublicKey(voterNftAccount);
      const answerKeyBN = convertToBN(answer_key);

      const transaction = await governanceSDK.voteAnswer(
        questKeyBN,
        answerKeyBN,
        voterPK,
        voterNftPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = voterPK;

      await client.Vote.UpdateAnswer(quest_key, voter, {
        answer_key,
        tx: 'pending',
      });

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Vote answer transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Vote answer error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setQuestResult: async (req, res) => {
    try {
      const { quest_key } = req.params;

      if (!quest_key) {
        throw new Error('quest_key is required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const transaction = await governanceSDK.setQuestResult(questKeyBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Set quest result transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set quest result error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  makeQuestResult: async (req, res) => {
    try {
      const { quest_key } = req.params;

      if (!quest_key) {
        throw new Error('quest_key is required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const transaction = await governanceSDK.makeQuestResult(questKeyBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Make quest result transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Make quest result error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  cancelQuest: async (req, res) => {
    try {
      const { quest_key } = req.params;

      if (!quest_key) {
        throw new Error('quest_key is required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const transaction = await governanceSDK.cancelQuest(questKeyBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Cancel quest transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Cancel quest error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  distributeReward: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { voter, voterTokenAccount } = req.body;

      if (!quest_key || !voter || !voterTokenAccount) {
        throw new Error('quest_key, voter và voterTokenAccount là bắt buộc');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const voterPK = convertToPublicKey(voter);
      const voterTokenPK = convertToPublicKey(voterTokenAccount);
      const [treasuryPda] = governanceSDK.getTreasuryPDA();

      const transaction = await governanceSDK.distributeReward(
        questKeyBN,
        voterPK,
        voterTokenPK,
        treasuryPda,
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Distribute reward transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Distribute reward error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  updateVoterCheckpoint: async (req, res) => {
    try {
      const { voter, nftTokenAccounts = [] } = req.body;
      if (!voter) {
        throw new Error('voter is required');
      }

      const governanceSDK = getGovernanceSDK();
      const voterPK = convertToPublicKey(voter);
      const nftAccountsPK = Array.isArray(nftTokenAccounts)
        ? nftTokenAccounts.map(a => convertToPublicKey(a))
        : [];

      const transaction = await governanceSDK.updateVoterCheckpoint(
        voterPK,
        nftAccountsPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        voter,
        message: 'Update voter checkpoint transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Update voter checkpoint error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  startDecision: async (req, res) => {
    try {
      const { quest_key } = req.params;

      if (!quest_key) {
        throw new Error('quest_key is required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const transaction = await governanceSDK.startDecision(questKeyBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Start decision transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Start decision error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setDecision: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { answers } = req.body;

      if (!quest_key || !answers) {
        throw new Error('quest_key and answers are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const answersBN = answers.map(answer => convertToBN(answer));

      const transaction = await governanceSDK.setDecision(questKeyBN, answersBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Set decision transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set decision error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  makeDecision: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { answers } = req.body;

      if (!quest_key || !answers) {
        throw new Error('quest_key and answers are required');
      }

      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const answersBN = answers.map(answer => convertToBN(answer));

      const transaction = await governanceSDK.makeDecision(questKeyBN, answersBN);

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(process.env.SOLANA_MASTER_WALLET);

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        questKey: quest_key,
        message: 'Make decision transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Make decision error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  pauseGovernance: async (req, res) => {
    try {
      const { pause, authority } = req.body;
      if (pause === undefined || !authority) {
        throw new Error('pause (boolean) and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);

      const transaction = await governanceSDK.pauseGovernance(!!pause, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Pause governance transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Pause governance error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setMinimumNfts: async (req, res) => {
    try {
      const { minNfts, authority } = req.body;
      if (minNfts === undefined || !authority) {
        throw new Error('minNfts and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);

      const transaction = await governanceSDK.setMinimumNfts(Number(minNfts), authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Set minimum NFTs transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set minimum NFTs error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setMaxVotesPerVoter: async (req, res) => {
    try {
      const { maxVotes, authority } = req.body;
      if (maxVotes === undefined || !authority) {
        throw new Error('maxVotes and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);

      const transaction = await governanceSDK.setMaxVotesPerVoter(Number(maxVotes), authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Set max votes per voter transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set max votes per voter error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  updateBaseTokenMint: async (req, res) => {
    try {
      const { newBaseTokenMint, authority } = req.body;
      if (!newBaseTokenMint || !authority) {
        throw new Error('newBaseTokenMint and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);
      const newTokenMintPK = convertToPublicKey(newBaseTokenMint);

      const transaction = await governanceSDK.updateBaseTokenMint(newTokenMintPK, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Update base token mint transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Update base token mint error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setQuestDurationHours: async (req, res) => {
    try {
      const { durationHours, authority } = req.body;
      if (durationHours === undefined || !authority) {
        throw new Error('durationHours and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);
      const hoursBN = new BN(Number(durationHours));

      const transaction = await governanceSDK.setQuestDurationHours(hoursBN, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Set quest duration hours transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set quest duration hours error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  setRewardAmount: async (req, res) => {
    try {
      const { rewardAmount, authority } = req.body;
      if (rewardAmount === undefined || !authority) {
        throw new Error('rewardAmount and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);
      const { BN } = require('@coral-xyz/anchor');
      const rewardInLamports = Math.floor(Number(rewardAmount) * 1e9);
      if (rewardInLamports <= 0) {
        throw new Error('rewardAmount must be greater than 0');
      }
      const rewardBN = new BN(rewardInLamports);

      const transaction = await governanceSDK.setRewardAmount(rewardBN, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Set reward amount transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set reward amount error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },


  setTotalVote: async (req, res) => {
    try {
      const { minTotalVote, maxTotalVote, authority } = req.body;
      if (minTotalVote === undefined || maxTotalVote === undefined || !authority) {
        throw new Error('minTotalVote, maxTotalVote and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);
      const minBN = new BN(Number(minTotalVote));
      const maxBN = new BN(Number(maxTotalVote));

      const transaction = await governanceSDK.setTotalVote(minBN, maxBN, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Set total vote transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set total vote error:', e);
      let errorCode = e?.statusCode ? e.statusCode : 400;
      res.status(errorCode).json(err(e));
    }
  },

  fetchConfig: async (_req, res) => {
    try {
      const governanceSDK = getGovernanceSDK();
      const data = await governanceSDK.fetchConfig();
      res.status(200).json(success(data));
    } catch (e) {
      console.error('Fetch config error:', e);
      res.status(400).json(err(e));
    }
  },

  fetchGovernance: async (_req, res) => {
    try {
      const governanceSDK = getGovernanceSDK();
      const data = await governanceSDK.fetchGovernance();
      res.status(200).json(success(data));
    } catch (e) {
      console.error('Fetch governance error:', e);
      res.status(400).json(err(e));
    }
  },

  fetchGovernanceItem: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const data = await governanceSDK.fetchGovernanceItem(questKeyBN);
      res.status(200).json(success(data));
    } catch (e) {
      console.error('Fetch governance item error:', e);
      res.status(400).json(err(e));
    }
  },

  fetchQuestVote: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);
      const data = await governanceSDK.fetchQuestVote(questKeyBN);
      res.status(200).json(success(data));
    } catch (e) {
      console.error('Fetch quest vote error:', e);
      res.status(400).json(err(e));
    }
  },

  fetchProposal: async (req, res) => {
    try {
      const { proposal_key } = req.params;
      const governanceSDK = getGovernanceSDK();
      const proposalKeyBN = convertToBN(proposal_key);
      const data = await governanceSDK.fetchProposal(proposalKeyBN);
      res.status(200).json(success(data));
    } catch (e) {
      console.error('Fetch proposal error:', e);
      res.status(400).json(err(e));
    }
  },

  initializeGovernance: async (req, res) => {
    try {
      const {
        minTotalVote,
        maxTotalVote,
        minRequiredNft,
        maxVotableNft,
        durationHours,
        constantRewardToken,
        baseTokenMint,
        baseNftCollection,
        authority
      } = req.body;

      if (
        minTotalVote === undefined ||
        maxTotalVote === undefined ||
        minRequiredNft === undefined ||
        maxVotableNft === undefined ||
        durationHours === undefined ||
        constantRewardToken === undefined ||
        !baseTokenMint || !baseNftCollection || !authority
      ) {
        throw new Error('Missing required fields for initialize governance');
      }

      const governanceSDK = getGovernanceSDK();
      const { BN } = require('@coral-xyz/anchor');
      const rewardInLamports = Math.floor(Number(constantRewardToken) * 1e9);
      if (rewardInLamports <= 0) {
        throw new Error('constantRewardToken must be greater than 0');
      }

      const tx = await governanceSDK.initialize(
        new BN(Number(minTotalVote)),
        new BN(Number(maxTotalVote)),
        Number(minRequiredNft),
        Number(maxVotableNft),
        new BN(Number(durationHours)),
        new BN(rewardInLamports),
        convertToPublicKey(baseTokenMint),
        convertToPublicKey(baseNftCollection),
        convertToPublicKey(authority)
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = convertToPublicKey(authority);

      res.status(200).json(success({
        transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Initialize governance transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Initialize governance error:', e);
      res.status(400).json(err(e));
    }
  },

  createCollection: async (req, res) => {
    try {
      const { name, symbol, uri, authority } = req.body;
      if (!name || !symbol || !uri || !authority) {
        throw new Error('name, symbol, uri, authority are required');
      }
      const governanceSDK = getGovernanceSDK();
      const authorityPK = convertToPublicKey(authority);

      const tx = await governanceSDK.createCollection(name, symbol, uri, authorityPK);
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = authorityPK;

      res.status(200).json(success({
        transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
        message: 'Create collection transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Create collection error:', e);
      res.status(400).json(err(e));
    }
  },

  mintGovernanceNft: async (req, res) => {
    try {
      const { name, symbol, uri, user } = req.body;
      if (!name || !symbol || !uri || !user) {
        throw new Error('name, symbol, uri, user are required');
      }

      const governanceSDK = getGovernanceSDK();
      const userPK = convertToPublicKey(user);

      const { transaction, nftMint } = await governanceSDK.mintGovernanceNft(
        name, symbol, uri, userPK
      );
      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPK;

      res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        nftMint: nftMint.publicKey.toBase58(),
        message: 'Mint governance NFT transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Mint governance NFT error:', e);
      res.status(400).json(err(e));
    }
  },

  canCreateGovernanceItem: async (req, res) => {
    try {
      const { user } = req.query;
      if (!user) {
        throw new Error('user is required');
      }
      const governanceSDK = getGovernanceSDK();
      const userPK = convertToPublicKey(String(user));
      const allowed = await governanceSDK.canCreateGovernanceItem(userPK);
      res.status(200).json(success({ allowed }));
    } catch (e) {
      console.error('canCreateGovernanceItem error:', e);
      res.status(400).json(err(e));
    }
  },

  /**
   * Submit transaction signature for monitoring (Vote)
   * Body: { signature, type, updateData }
   */
  submitTransactionSignature: async (req, res) => {
    try {
      const { quest_key } = req.params;
      const { signature, type, updateData } = req.body;

      if (!signature || !type) {
        return res.status(400).json(err(new Error('signature and type are required')));
      }

      transactionStatusService.addPendingTransaction(signature, quest_key, type, updateData);

      return res.status(200).json(success({
        signature,
        questKey: quest_key,
        message: 'Transaction signature submitted for monitoring. Database will be updated when confirmed.'
      }, 'Transaction monitoring started'));
    } catch (e) {
      console.error('Vote submit transaction signature error:', e);
      return res.status(400).json(err(e));
    }
  },

  createProposal: async (req, res) => {
    try {
      const { proposal_key, title, creator } = req.body;
      if (!proposal_key || !title || !creator) {
        throw new Error('proposal_key, title and creator are required');
      }

      const governanceSDK = getGovernanceSDK();
      const proposalKeyBN = convertToBN(proposal_key);
      const creatorPK = convertToPublicKey(creator);

      const transaction = await governanceSDK.createProposal(
        proposalKeyBN,
        title,
        creatorPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = creatorPK;

      return res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        proposalKey: String(proposal_key),
        message: 'Create proposal transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Create proposal error:', e);
      return res.status(400).json(err(e));
    }
  },

  setProposalResultAdmin: async (req, res) => {
    try {
      const { proposal_key } = req.params;
      const { result, resultVote, authority } = req.body;
      if (!proposal_key || !result || resultVote === undefined || !authority) {
        throw new Error('proposal_key (param), result (yes|no), resultVote and authority are required');
      }

      const governanceSDK = getGovernanceSDK();
      const proposalKeyBN = convertToBN(proposal_key);
      const authorityPK = convertToPublicKey(authority);

      const transaction = await governanceSDK.setProposalResult(
        proposalKeyBN,
        result === 'yes' ? 'yes' : 'no',
        Number(resultVote),
        authorityPK
      );

      const { blockhash } = await governanceSDK.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPK;

      return res.status(200).json(success({
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        proposalKey: String(proposal_key),
        message: 'Set proposal result transaction created. Please sign and submit.'
      }));
    } catch (e) {
      console.error('Set proposal result error:', e);
      return res.status(400).json(err(e));
    }
  },
};
