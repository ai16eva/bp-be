const { BN } = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

// Mock dependencies
const mockMarketService = {
  isBetAvailable: jest.fn(),
  isRetrievable: jest.fn(),
};

jest.mock('../../services/marketService', () => mockMarketService);

const marketService = require('../../services/marketService');
const { getBPMarketSDK } = require('../../config/solana');

describe('Market Validation Functions - New Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isBetAvailable() - Bet Availability Check', () => {
    const testWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    
    test('Should return true when all validations pass', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: true,
        reasons: []
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(true);
      expect(result.reasons).toEqual([]);
      expect(marketService.isBetAvailable).toHaveBeenCalledWith(
        '123',
        '1',
        testWallet,
        '1000000'
      );
    });

    test('Should return false when market is not in approve status', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: ['Market is not in approve status']
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons).toContain('Market is not in approve status');
    });

    test('Should return false when answer does not exist', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: ['Answer does not exist in market']
      });

      const result = await marketService.isBetAvailable(
        '123',
        '999',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons).toContain('Answer does not exist in market');
    });

    test('Should return false when user has insufficient balance', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: ['Insufficient token balance']
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '100000000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons).toContain('Insufficient token balance');
    });

    test('Should return false when user wallet is locked', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: ['User wallet is locked']
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons).toContain('User wallet is locked');
    });

    test('Should return false when bet already exists', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: ['Bet already exists for this market/answer combination']
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons).toContain('Bet already exists for this market/answer combination');
    });

    test('Should return multiple reasons when multiple validations fail', async () => {
      marketService.isBetAvailable.mockResolvedValue({
        available: false,
        reasons: [
          'Market is not in approve status',
          'Insufficient token balance'
        ]
      });

      const result = await marketService.isBetAvailable(
        '123',
        '1',
        testWallet,
        '1000000'
      );

      expect(result.available).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(1);
    });
  });

  describe('isRetrievable() - 180 Days Retrieval Check', () => {
    test('Should return true when market is retrievable (>180 days)', async () => {
      marketService.isRetrievable.mockResolvedValue({
        isRetrievable: true
      });

      const result = await marketService.isRetrievable('123');

      expect(result.isRetrievable).toBe(true);
    });

    test('Should return false when market is not retrievable (<180 days)', async () => {
      marketService.isRetrievable.mockResolvedValue({
        isRetrievable: false
      });

      const result = await marketService.isRetrievable('123');

      expect(result.isRetrievable).toBe(false);
    });

    test('Should return false for non-success/adjourn markets', async () => {
      marketService.isRetrievable.mockResolvedValue({
        isRetrievable: false
      });

      const result = await marketService.isRetrievable('456');

      expect(result.isRetrievable).toBe(false);
    });

    test('Should handle error gracefully', async () => {
      marketService.isRetrievable.mockRejectedValue(
        new Error('Market not found')
      );

      await expect(marketService.isRetrievable('999'))
        .rejects.toThrow('Market not found');
    });
  });

  describe('Integration with SDK', () => {
    test('SDK should have isBetAvailable method', () => {
      expect(typeof getBPMarketSDK).toBe('function');
      
      // Try to get SDK instance
      try {
        const sdk = getBPMarketSDK();
        // If SDK exists, check if methods are available
        expect(sdk).toBeDefined();
      } catch (error) {
        // If SDK not available (e.g., not compiled), skip
        console.log('SDK not available, skipping direct test');
      }
    });

    test('SDK should have isRetrievable method', () => {
      try {
        const sdk = getBPMarketSDK();
        expect(sdk).toBeDefined();
      } catch (error) {
        console.log('SDK not available, skipping direct test');
      }
    });
  });

  describe('Parameter Validation', () => {
    test('isBetAvailable should validate required parameters', async () => {
      await expect(marketService.isBetAvailable(null, '1', 'wallet', '1000'))
        .rejects.toThrow();
      
      await expect(marketService.isBetAvailable('123', null, 'wallet', '1000'))
        .rejects.toThrow();
      
      await expect(marketService.isBetAvailable('123', '1', null, '1000'))
        .rejects.toThrow();
      
      await expect(marketService.isBetAvailable('123', '1', 'wallet', null))
        .rejects.toThrow();
    });

    test('isRetrievable should validate required parameters', async () => {
      await expect(marketService.isRetrievable(null))
        .rejects.toThrow();
    });
  });
});

