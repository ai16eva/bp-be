const request = require('supertest');

// Mock authentication middleware
jest.mock('../../middlewares/authWeb3', () => ({
  adminAuth: (req, res, next) => next(),
  memberAuth: (req, res, next) => next()
}));

// Mock Solana service
jest.mock('../../services/solanaService', () => ({
  getSolanaService: jest.fn(() => ({
    isUserLocked: jest.fn().mockResolvedValue({ success: true, isLocked: false }),
    createBetTransaction: jest.fn().mockResolvedValue({ 
      success: true, 
      transaction: 'mock_transaction_hash_string' // String instead of object
    }),
    getAvailableReceiveTokens: jest.fn().mockResolvedValue({ 
      success: true, 
      availableTokens: '1000000' 
    }),
    createReceiveTokenTransaction: jest.fn().mockResolvedValue({ 
      success: true, 
      transaction: 'mock_receive_transaction_hash_string' // String instead of object
    }),
    getMarketInfo: jest.fn().mockResolvedValue({ 
      success: true, 
      marketInfo: { title: 'Test Market', description: 'Test Description' } 
    }),
    getUserBetInfo: jest.fn().mockResolvedValue({ 
      success: true, 
      betInfo: { exists: true, amount: '1000000' } 
    })
  }))
}));

// Mock database models index
jest.mock('../../models/mysql/index', () => ({
  bettings: {
    create: jest.fn().mockResolvedValue({ 
      id: 1,
      toJSON: jest.fn().mockReturnValue({ id: 1 })
    }),
    findOne: jest.fn().mockResolvedValue({ 
      id: 1, 
      quest_key: '123', 
      answer_key: '1',
      betting_address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      toJSON: jest.fn().mockReturnValue({ 
        id: 1, 
        quest_key: '123', 
        answer_key: '1',
        betting_address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
      })
    }),
    update: jest.fn().mockResolvedValue([1]),
  },
  quest: {
    findOne: jest.fn().mockResolvedValue({ 
      quest_key: '123', 
      title: 'Test Quest',
      description: 'Test Description',
      toJSON: jest.fn().mockReturnValue({ 
        quest_key: '123', 
        title: 'Test Quest',
        description: 'Test Description'
      })
    }),
  },
  answer: {
    findOne: jest.fn().mockResolvedValue({ 
      answer_key: '1', 
      quest_key: '123',
      answer_text: 'Test Answer',
      toJSON: jest.fn().mockReturnValue({ 
        answer_key: '1', 
        quest_key: '123',
        answer_text: 'Test Answer'
      })
    }),
  }
}));

const app = require('../../../app');

describe('Solana Betting Flow Tests', () => {
  const testSolanaWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  
  describe('POST /betting/add - Add Betting', () => {
    test('[200 OK] : Should create betting successfully', async () => {
      const response = await request(app)
        .post('/betting/add')
        .send({
          quest_key: '123',
          answer_key: '1',
          betting_amount: '1000000',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
    });

    test('[400 Bad Request] : Should reject invalid wallet address', async () => {
      const response = await request(app)
        .post('/betting/add')
        .send({
          quest_key: '123',
          answer_key: '1',
          betting_amount: '1000000',
          betting_address: 'invalid_address'
        });

      expect([400, 405]).toContain(response.status);
      expect(response.body.success).toBe(0);
    });

    test('[400 Bad Request] : Should reject missing required fields', async () => {
      const response = await request(app)
        .post('/betting/add')
        .send({
          quest_key: '123',
          // Missing answer_key, betting_amount, betting_address
        });

      expect([400, 405]).toContain(response.status);
      expect(response.body.success).toBe(0);
    });
  });

  describe('PUT /betting/confirm/:betting_key - Confirm Betting', () => {
    test('[200 OK] : Should confirm betting successfully', async () => {
      const response = await request(app)
        .put('/betting/confirm/1')
        .send({
          betting_tx: 'mock_transaction_hash',
          quest_key: '123',
          answer_key: '1',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
    });
  });

  describe('PUT /betting/claim-reward/:betting_key - Claim Reward', () => {
    test('[200 OK] : Should claim reward successfully', async () => {
      const response = await request(app)
        .put('/betting/claim-reward/1')
        .send({
          reward_tx: 'mock_reward_transaction_hash',
          quest_key: '123',
          answer_key: '1',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
    });
  });

  describe('POST /betting/available-receive-tokens - Check Available Tokens', () => {
    test('[200 OK] : Should return available tokens', async () => {
      const response = await request(app)
        .post('/betting/available-receive-tokens')
        .send({
          quest_key: '123',
          answer_key: '1',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('POST /betting/receive-token - Receive Token', () => {
    test('[200 OK] : Should create receive token transaction', async () => {
      const response = await request(app)
        .post('/betting/receive-token')
        .send({
          quest_key: '123',
          answer_key: '1',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
    });
  });

  describe('GET /betting/market-info/:quest_key - Get Market Info', () => {
    test('[200 OK] : Should return market info', async () => {
      const response = await request(app)
        .get('/betting/market-info/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('POST /betting/user-bet-info - Get User Bet Info', () => {
    test('[200 OK] : Should return user bet info', async () => {
      const response = await request(app)
        .post('/betting/user-bet-info')
        .send({
          quest_key: '123',
          answer_key: '1',
          betting_address: testSolanaWallet
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(1);
      expect(response.body.data).toBeDefined();
    });
  });

});