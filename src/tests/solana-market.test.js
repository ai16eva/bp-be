const request = require('supertest');
const app = require('../../app');

// Mock Solana SDK and connection dependent functions to avoid network calls
jest.mock('../../src/config/solana', () => {
  const { Transaction, PublicKey } = require('@solana/web3.js');
  const transactionWithIx = () => new Transaction();
  const mockBPMarketSDK = {
    publishMarket: jest.fn(() => transactionWithIx()),
    successMarket: jest.fn(() => transactionWithIx()),
    adjournMarket: jest.fn(() => transactionWithIx()),
    retrieveTokens: jest.fn(() => transactionWithIx()),
    getMarketInfo: jest.fn(() => ({
      creator: new PublicKey('11111111111111111111111111111111').toString(),
      title: 'Mock Market',
      status: 'approve',
      totalTokens: '0',
      remainTokens: '0',
      rewardBaseTokens: '0',
      correctAnswerKey: null,
      approveTime: '0',
      successTime: '0',
      adjournTime: '0',
    })),
    getMarketStatus: jest.fn(() => 'approve'),
    connection: {
      getRecentBlockhash: jest.fn(async () => ({ blockhash: '11111111111111111111111111111111' })),
    },
  };
  return {
    getBPMarketSDK: () => mockBPMarketSDK,
    getGovernanceSDK: () => ({
      connection: { getRecentBlockhash: jest.fn(async () => ({ blockhash: '11111111111111111111111111111111' })) },
    }),
  };
});

describe('Solana Market Operations', () => {
  const testQuestKey = '123';
  const testMarketKey = '123456789';
  const testCreator = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const testUser = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

  describe('POST /quests/:quest_key/publish', () => {
    it('should create publish market transaction', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/publish`)
        .send({
          marketKey: testMarketKey,
          creator: testCreator,
          title: 'Test Market',
          createFee: '1000000',
          creatorFeePercentage: '500',
          serviceFeePercentage: '200',
          charityFeePercentage: '100',
          answerKeys: ['1', '2']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('transaction');
      expect(response.body.data).toHaveProperty('questKey', testQuestKey);
      expect(response.body.data).toHaveProperty('message');
    });

    it('should return error for missing required parameters', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/publish`)
        .send({
          marketKey: testMarketKey
          // Missing creator and title
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(0);
    });
  });

  describe('POST /quests/:quest_key/success', () => {
    it('should create success market transaction', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/success`)
        .send({
          marketKey: testMarketKey,
          correctAnswerKey: '1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('transaction');
      expect(response.body.data).toHaveProperty('questKey', testQuestKey);
    });

    it('should return error for missing parameters', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/success`)
        .send({
          marketKey: testMarketKey
          // Missing correctAnswerKey
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /quests/:quest_key/adjourn', () => {
    it('should create adjourn market transaction', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/adjourn`)
        .send({
          marketKey: testMarketKey,
          owner: testCreator
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('transaction');
    });
  });

  describe('POST /quests/:quest_key/retrieve', () => {
    it('should create retrieve tokens transaction', async () => {
      const response = await request(app)
        .post(`/quests/${testQuestKey}/retrieve`)
        .send({
          marketKey: testMarketKey,
          user: testUser
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('transaction');
    });
  });

  describe('GET /quests/:quest_key/market-info', () => {
    it('should get market information', async () => {
      const response = await request(app)
        .get(`/quests/${testQuestKey}/market-info`)
        .query({ marketKey: testMarketKey });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('questKey', testQuestKey);
      expect(response.body.data).toHaveProperty('marketInfo');
    });

    it('should return error for missing marketKey', async () => {
      const response = await request(app)
        .get(`/quests/${testQuestKey}/market-info`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /quests/:quest_key/market-status', () => {
    it('should get market status', async () => {
      const response = await request(app)
        .get(`/quests/${testQuestKey}/market-status`)
        .query({ marketKey: testMarketKey });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toHaveProperty('questKey', testQuestKey);
      expect(response.body.data).toHaveProperty('status');
    });
  });
});
