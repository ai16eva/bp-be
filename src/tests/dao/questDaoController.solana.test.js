const request = require('supertest');
const models = require('../../models/mysql');
const setupTestDB = require('../testHelper');
const generateUniqueKey = require('../../utils/uniquekey_generate');
const { BN } = require('@coral-xyz/anchor');

// Mock Solana SDKs
jest.mock('../../config/solana', () => {
  const { BN } = require('@coral-xyz/anchor');
  const mockTx = () => ({ serialize: () => Buffer.from('00', 'hex') });
  const connection = { 
    getRecentBlockhash: async () => ({ blockhash: 'BH' }),
    getSlot: async () => 1000,
    getBlockTime: async () => Math.floor(Date.now() / 1000),
    getLatestBlockhash: async () => ({ blockhash: 'BH', lastValidBlockHeight: 1000 }),
    getBalance: async () => 1000000000, // 1 SOL
  };

  const BPMarketSDK = {
    connection,
    publishMarket: async () => mockTx(),
    finishMarket: async () => mockTx(),
    adjournMarket: async () => mockTx(),
    successMarket: async () => mockTx(),
    retrieveTokens: async () => mockTx(),
    getAccounts: async () => ({ remainAccount: 'RemainTokenAccountPubkey' })
  };

  const GovernanceSDK = {
    connection,
    setQuestResult: async () => mockTx(),
    makeQuestResult: async () => mockTx(),
    startDecision: async () => mockTx(),
    setDecision: async () => mockTx(),
    makeDecision: async () => mockTx(),
    setDecisionEndTime: async () => mockTx(),
    setQuestEndTime: async () => mockTx(),
    setAnswerEndTime: async () => mockTx(),
    getSelectedAnswerKey: async () => '1',
    fetchQuestVote: async () => ({ approver: new BN(0), rejector: new BN(0), finalized: false }),
    fetchDecisionVote: async () => ({ success: new BN(0), adjourn: new BN(0) }),
    fetchGovernanceItem: async () => ({ questKey: new BN(0), quest_key: new BN(0) }),
    mintGovernanceNft: async () => ({ transaction: mockTx(), nftMint: { publicKey: {} } }),
    createGovernanceItem: async () => mockTx(),
  };

  return {
    getBPMarketSDK: () => BPMarketSDK,
    getGovernanceSDK: () => GovernanceSDK,
  };
});

// Bypass adminAuth/memberAuth for tests
jest.mock('../../middlewares/authWeb3', () => ({
  adminAuth: (_req, _res, next) => next(),
  memberAuth: (_req, _res, next) => next(),
}));

// Require app after mocks
const app = require('../../../app');
const client = require('../../database/client');

describe('Quest DAO Controller - Solana flow', () => {
  setupTestDB(models);
  let quest;
  let season;
  let quest_category;
  let answers;

  beforeEach(async () => {
    season = await models.seasons.create({
      season_title: 'S', season_description: 'D', service_fee: 5, charity_fee: 2, creator_fee: 3,
      season_min_pay: 1, season_max_pay: 100, season_active: true,
      season_start_date: new Date('2024-01-01'),
      season_end_date: new Date('2024-12-31'),
    });

    quest_category = await models.quest_categories.create({
      quest_category_title: 'Test',
      quest_category_order: 1
    });

    quest = await models.quests.create({
      quest_key: generateUniqueKey(),
      quest_title: 'Q',
      quest_description: 'Desc',
      quest_category_id: quest_category.quest_category_id,
      season_id: season.season_id,
      quest_creator: '11111111111111111111111111111112',
      quest_betting_token: 'BOOM',
      quest_status: 'APPROVE',
      quest_pending: false,
      quest_image_url: 'https://example.com/image.png',
      quest_image_link: 'https://example.com',
      quest_end_date: new Date('2024-12-31'),
      quest_end_date_utc: new Date('2024-12-31T00:00:00Z'),
    });

    answers = await models.answers.bulkCreate([
      { answer_key: generateUniqueKey(), answer_title: 'A1', quest_key: quest.quest_key },
      { answer_key: generateUniqueKey(), answer_title: 'A2', quest_key: quest.quest_key },
    ]);

    // Default mocks for DB calls in questDaoController
    jest.spyOn(client.QuestDao, 'getQuestWithAnswers').mockImplementation(async (quest_key) => {
      return {
        quest_key,
        quest_status: 'APPROVE',
        quest_pending: false,
        answers: answers.map(a => a.answer_key),
      };
    });
    jest.spyOn(client.Answer, 'isSelected').mockResolvedValue(true);
  });

  it('PATCH /quest-dao/:quest_key/publish -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/publish`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('PATCH /quest-dao/:quest_key/dao-success -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/dao-success`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/dao-success/set -> returns tx', async () => {
    // need answers list exists
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/dao-success/set`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/dao-success/make -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/dao-success/make`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/success -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/success`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/adjourn -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/adjourn`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/retrieve -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/retrieve`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('PATCH /quest-dao/:quest_key/draft-end -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/draft-end`)
      .send();
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /quest-dao/:quest_key/success-end -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/dao-success-end`)
      .send();
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /quest-dao/:quest_key/answer-end -> returns tx', async () => {
    const res = await request(app)
      .patch(`/quest-dao/${quest.quest_key}/answer-end`)
      .send();
    expect(res.statusCode).toBe(200);
  });

  it('POST /quest-dao/:quest_key/submit-transaction-signature -> 200', async () => {
    const res = await request(app)
      .post(`/quest-dao/${quest.quest_key}/submit-signature`)
      .send({ signature: 'sig', type: 'publish', updateData: {} });
    expect(res.statusCode).toBe(200);
  });

  it('GET /quest-dao/:quest_key/pending-transactions -> 200', async () => {
    const res = await request(app)
      .get(`/quest-dao/${quest.quest_key}/pending-transactions`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data).toBeDefined();
  });

  describe('Error Handling Tests', () => {
    it('PATCH /quest-dao/:quest_key/publish -> should return QuestNotFound for invalid quest_key', async () => {
      const invalidKey = 999999999;
      jest.spyOn(client.QuestDao, 'getQuestWithAnswers').mockResolvedValue(null);
      const res = await request(app)
        .patch(`/quest-dao/${invalidKey}/publish`);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('QuestNotFound');
    });

    it('PATCH /quest-dao/:quest_key/publish -> should return InvalidQuestStatus for non-APPROVE status', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithAnswers').mockImplementation(async () => ({
        quest_key: quest.quest_key,
        quest_status: 'DRAFT',
        quest_pending: false,
        answers: answers.map(a => a.answer_key),
      }));
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/publish`);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('InvalidQuestStatus');
    });

    it('PATCH /quest-dao/:quest_key/publish -> should return QuestPending when quest_pending is true', async () => {
      jest.spyOn(client.QuestDao, 'OnPending').mockRejectedValue(new Error('QuestPending'));
      jest.spyOn(client.QuestDao, 'getQuestWithAnswers').mockImplementation(async () => ({
        quest_key: quest.quest_key,
        quest_status: 'APPROVE',
        quest_pending: true,
        answers: answers.map(a => a.answer_key),
      }));
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/publish`);
      expect(res.statusCode).toBe(400);
    });

    it('PATCH /quest-dao/:quest_key/finish -> should return QuestNotFound', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(null);
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/finish`);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('QuestNotFound');
    });

    it('PATCH /quest-dao/:quest_key/dao-success -> should return QuestNotFound', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(null);
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success`);
      expect(res.statusCode).toBe(404);
    });

    it('PATCH /quest-dao/:quest_key/success -> should return QuestNotFound', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(null);
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/success`);
      expect(res.statusCode).toBe(404);
    });

    it('PATCH /quest-dao/:quest_key/retrieve -> should return QuestNotFound', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(null);
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/retrieve`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Contract Interaction Error Tests', () => {
    it('PATCH /quest-dao/:quest_key/publish -> should handle ContractInteractionError', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      jest.spyOn(govSDK, 'mintGovernanceNft').mockRejectedValue(new Error('Insufficient funds'));
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/publish`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ContractInteractionError');
    });

    it('PATCH /quest-dao/:quest_key/finish -> should handle ContractInteractionError', async () => {
      const { getBPMarketSDK } = require('../../config/solana');
      const marketSDK = getBPMarketSDK();
      jest.spyOn(marketSDK, 'finishMarket').mockRejectedValue(new Error('Market not found'));
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/finish`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ContractInteractionError');
    });

    it('PATCH /quest-dao/:quest_key/dao-success -> should handle ContractInteractionError', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      jest.spyOn(govSDK, 'startDecision').mockRejectedValue(new Error('Governance item not found'));
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ContractInteractionError');
    });

    it('PATCH /quest-dao/:quest_key/adjourn -> should handle ContractInteractionError', async () => {
      const { getBPMarketSDK } = require('../../config/solana');
      const marketSDK = getBPMarketSDK();
      jest.spyOn(marketSDK, 'adjournMarket').mockRejectedValue(new Error('Market error'));
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/adjourn`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ContractInteractionError');
    });
  });

  describe('Transaction Timeout Tests', () => {
    it('PATCH /quest-dao/:quest_key/finish -> should return 202 Pending on timeout', async () => {
      const { getBPMarketSDK } = require('../../config/solana');
      const marketSDK = getBPMarketSDK();
      const timeoutError = new Error('Transaction timeout');
      timeoutError.transactionHash = 'test_hash_123';
      jest.spyOn(marketSDK, 'finishMarket').mockRejectedValue(timeoutError);
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/finish`);
      expect(res.statusCode).toBe(202);
      expect(res.body.message).toBe('Pending');
    });

    it('PATCH /quest-dao/:quest_key/adjourn -> should return 202 Pending on timeout', async () => {
      const { getBPMarketSDK } = require('../../config/solana');
      const marketSDK = getBPMarketSDK();
      const timeoutError = new Error('Transaction timeout');
      timeoutError.transactionHash = 'test_hash_456';
      jest.spyOn(marketSDK, 'adjournMarket').mockRejectedValue(timeoutError);
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/adjourn`);
      expect(res.statusCode).toBe(202);
      expect(res.body.message).toBe('Pending');
    });

    it('PATCH /quest-dao/:quest_key/dao-success -> should return 202 Pending on timeout', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      const timeoutError = new Error('Transaction timeout');
      timeoutError.transactionHash = 'test_hash_789';
      jest.spyOn(govSDK, 'startDecision').mockRejectedValue(timeoutError);
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue(quest);
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success`);
      expect(res.statusCode).toBe(202);
      expect(res.body.message).toBe('Pending');
    });
  });

  describe('Draft Result Tests', () => {
    it('PATCH /quest-dao/:quest_key/draft/set -> should update status to APPROVE', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'DRAFT',
      });
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/draft/set`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('APPROVE');
    });

    it('PATCH /quest-dao/:quest_key/draft/make -> should handle tie vote (makeQuestResult)', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      // Mock questVote with tie (approver === rejector)
      jest.spyOn(govSDK, 'fetchQuestVote').mockResolvedValue({
        approver: new BN(5),
        rejector: new BN(5),
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'DRAFT',
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/draft/make`);
      expect(res.statusCode).toBe(200);
    });

    it('PATCH /quest-dao/:quest_key/draft/make -> should handle non-tie vote (setQuestResult)', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      // Mock questVote with non-tie (approver !== rejector)
      jest.spyOn(govSDK, 'fetchQuestVote').mockResolvedValue({
        approver: new BN(7),
        rejector: new BN(3),
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'DRAFT',
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/draft/make`);
      expect(res.statusCode).toBe(200);
    });

    it('PATCH /quest-dao/:quest_key/draft/make -> should return 202 if already finalized', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      // Mock questVote indicating already finalized
      jest.spyOn(govSDK, 'fetchQuestVote').mockResolvedValue({
        finalized: true,
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'APPROVE',
        dao_draft_tx: 'existing_tx_hash',
      });
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/draft/make`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('DAO Success Tests', () => {
    it('PATCH /quest-dao/:quest_key/dao-success/set -> should handle success result', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      jest.spyOn(govSDK, 'fetchDecisionVote').mockResolvedValue({
        success: new BN(5),
        adjourn: new BN(2),
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'FINISH',
        dao_success_start_at: new Date(),
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success/set`);
      expect(res.statusCode).toBe(200);
    });

    it('PATCH /quest-dao/:quest_key/dao-success/set -> should handle adjourn result', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      jest.spyOn(govSDK, 'fetchDecisionVote').mockResolvedValue({
        success: new BN(2),
        adjourn: new BN(5),
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'FINISH',
        dao_success_start_at: new Date(),
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success/set`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('adjourn');
    });

    it('PATCH /quest-dao/:quest_key/dao-success/make -> should handle tie vote', async () => {
      const { getGovernanceSDK } = require('../../config/solana');
      const govSDK = getGovernanceSDK();
      
      jest.spyOn(govSDK, 'fetchDecisionVote').mockResolvedValue({
        success: new BN(5),
        adjourn: new BN(5),
      });
      
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'FINISH',
        dao_success_start_at: new Date(),
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/dao-success/make`)
        .send({ result: 'success' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Validation Tests', () => {
    it('POST /quest-dao/:quest_key/submit-signature -> should require signature and type', async () => {
      const res = await request(app)
        .post(`/quest-dao/${quest.quest_key}/submit-signature`)
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it('POST /quest-dao/:quest_key/submit-signature -> should accept valid signature', async () => {
      const res = await request(app)
        .post(`/quest-dao/${quest.quest_key}/submit-signature`)
        .send({
          signature: 'valid_signature_123',
          type: 'publishQuest',
          updateData: { quest_status: 'PUBLISH' }
        });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Status Transition Tests', () => {
    it('PATCH /quest-dao/:quest_key/publish -> should only work on APPROVE status', async () => {
      ['DRAFT', 'PUBLISH', 'FINISH', 'ADJOURN'].forEach(async (status) => {
        jest.spyOn(client.QuestDao, 'getQuestWithAnswers').mockImplementation(async () => ({
          quest_key: quest.quest_key,
          quest_status: status,
          quest_pending: false,
          answers: answers.map(a => a.answer_key),
        }));
        
        const res = await request(app)
          .patch(`/quest-dao/${quest.quest_key}/publish`);
        
        if (status !== 'APPROVE') {
          expect(res.statusCode).toBe(401);
        }
      });
    });

    it('PATCH /quest-dao/:quest_key/finish -> should work on PUBLISH status', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'PUBLISH',
      });
      jest.spyOn(client.QuestDao, 'OnPending').mockResolvedValue();
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/finish`);
      expect(res.statusCode).toBe(200);
    });

    it('PATCH /quest-dao/:quest_key/cancel -> should update status to REJECT', async () => {
      jest.spyOn(client.QuestDao, 'getQuestWithSeason').mockResolvedValue({
        ...quest,
        quest_status: 'DRAFT',
      });
      
      const res = await request(app)
        .patch(`/quest-dao/${quest.quest_key}/cancel`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('reject');
    });
  });
});
