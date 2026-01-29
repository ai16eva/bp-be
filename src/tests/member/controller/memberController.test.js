const request = require('supertest');
const path = require('path');
const app = require('../../../../app');
const client = require('../../../database/client');
const setupTestDB = require('../../testHelper');
const models = require('../../../models/mysql');

describe('Member Controller', () => {
  const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  setupTestDB(models);
  describe('POST /member', () => {
    it('[200 OK] : Must create one member', async () => {
      const res = await request(app).post('/member').send({ wallet_address: testWalletAddress });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Assuming you have a way to retrieve the created member
      const createdMember = await client.Member.Get(testWalletAddress.toLowerCase());

      expect(testWalletAddress.toLowerCase()).toBe(createdMember.wallet_address);
    });

    it('[400 Bad Request] : Should return error for invalid wallet address', async () => {
      const invalidWalletAddress = 'invalid_address';

      const res = await request(app).post('/member').send({ wallet_address: invalidWalletAddress });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('WalletAddressInvalid');
      expect(res.body.message).toBe('Invalid wallet address');
    });

    it('[400 Bad Request] : Should return error for empty wallet address', async () => {
      const res = await request(app).post('/member').send({ wallet_address: '' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('WalletAddressInvalid');
      expect(res.body.message).toBe('Wallet address must be a non-empty string');
    });

    it('[400 Bad Request] : Should return error for missing wallet address', async () => {
      const res = await request(app).post('/member').send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('WalletAddressInvalid');
      expect(res.body.message).toBe('Wallet address cannot be null or undefined');
    });
    it('[400 Bad Request] : Should return error for duplicate member', async () => {
      const res = await request(app).post('/member').send({ wallet_address: testWalletAddress });

      const res_2 = await request(app).post('/member').send({ wallet_address: testWalletAddress });

      expect(res_2.statusCode).toBe(400);
      expect(res_2.body.success).toBe(0);
      expect(res_2.body.error).toBe('MemberDuplicate');
      expect(res_2.body.message).toBe('Wallet address duplicate');
    });
  });
  describe('GET /member/:wallet_address', () => {
    it('[200 OK] : Should get member details', async () => {
      // First create a member
      await request(app).post('/member').send({ wallet_address: testWalletAddress });

      const res = await request(app).get(`/member/${testWalletAddress}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);
      expect(res.body.data.wallet_address).toBe(testWalletAddress.toLowerCase());
    });

    it('[404 Not Found] : Should return error for non-existent member', async () => {
      const nonExistentAddress = '0x1234567890123456789012345678901234567890';
      const res = await request(app).get(`/member/${nonExistentAddress}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('MemberNotFound');
      expect(res.body.message).toBe('Member not found');
    });
  });
  describe('PUT /member/:wallet_address', () => {
    const testImagePath = path.join(__dirname, 'test_pic.png');
    beforeEach(async () => {
      // Create a test member before each test
      await request(app).post('/member').send({ wallet_address: testWalletAddress });
    });

    it('[200 OK] : Should update member details without avatar', async () => {
      const updateData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const res = await request(app).put(`/member/${testWalletAddress}`).send(updateData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Verify the update
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_name).toBe(updateData.name);
      expect(updatedMember.member_email).toBe(updateData.email);
    });

    it('[200 OK] : Should update member details with avatar', async () => {
      const updateData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      // Path to a test image file (you need to create this file)

      const res = await request(app)
        .put(`/member/${testWalletAddress}`)
        .field('name', updateData.name)
        .field('email', updateData.email)
        .attach('avatar', testImagePath); // Attach the actual file

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Verify the update
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_name).toBe(updateData.name);
      expect(updatedMember.member_email).toBe(updateData.email);
      expect(updatedMember.member_avatar).toMatch(/^https:\/\/forecast-assets\.s3\.ap-northeast-2\.amazonaws\.com\//);
    });

    it('[200 OK] : Should update member email only', async () => {
      const updateData = {
        email: 'newemail@example.com',
      };

      const res = await request(app).put(`/member/${testWalletAddress}`).send(updateData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Verify the update
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_email).toBe(updateData.email);
      // Ensure other fields haven't changed
      expect(updatedMember.member_name).toBeNull();
      expect(updatedMember.member_avatar).toBeNull();
    });

    it('[200 OK] : Should update member email if is null', async () => {
      const updateData = {
        email: 'newemail@example.com',
      };

      await request(app).put(`/member/${testWalletAddress}`).send(updateData);
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_email).toBe(updateData.email);
      const updateData_2 = {
        email: null,
        name: 'nick',
      };
      const res = await request(app).put(`/member/${testWalletAddress}`).send(updateData_2);
      // Verify the update
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Ensure other fields haven't changed
      const updatedMember_2 = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember_2.member_email).toBeNull();
      expect(updatedMember_2.member_name).toBe(updateData_2.name);
      expect(updatedMember_2.member_avatar).toBeNull();
    });

    it('[200 OK] : Should update member name only', async () => {
      const updateData = {
        name: 'Jane Doe',
      };

      const res = await request(app).put(`/member/${testWalletAddress}`).send(updateData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Verify the update
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_name).toBe(updateData.name);
      // Ensure other fields haven't changed
      expect(updatedMember.member_email).toBeNull();
      expect(updatedMember.member_avatar).toBeNull();
    });

    it('[200 OK] : Should update member avatar only', async () => {
      const res = await request(app).put(`/member/${testWalletAddress}`).attach('avatar', testImagePath);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      // Verify the update
      const updatedMember = await client.Member.Get(testWalletAddress.toLowerCase());
      expect(updatedMember.member_avatar).toMatch(/^https:\/\/forecast-assets\.s3\.ap-northeast-2\.amazonaws\.com\//);
      // Ensure other fields haven't changed
      expect(updatedMember.member_name).toBeNull();
      expect(updatedMember.member_email).toBeNull();
    });
  });
  describe('PATCH /member/:wallet_address/delegate', () => {
    const validWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const validDelegatedTx = '0x1234567890123456789012345678901234567890123456789012345678901234';

    beforeEach(async () => {
      // Create a test member before each test if necessary
      await request(app).post('/member').send({ wallet_address: validWalletAddress });
    });

    it('[200 OK] : Should update member delegate successfully', async () => {
      const updateData = {
        delegated_tx: validDelegatedTx,
      };

      const res = await request(app).patch(`/member/${validWalletAddress}/delegate`).send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);
      expect(res.body.message).toBe('Delegated!');

      // Verify the update in the database
      const updatedMember = await client.Member.Get(validWalletAddress.toLowerCase());
      expect(updatedMember.member_delegated_tx).toBe(validDelegatedTx);
    });

    it('[400 Bad Request] : Should fail with invalid transaction hash', async () => {
      const updateData = {
        delegated_tx: 'invalid_tx_hash',
      };

      const res = await request(app).patch(`/member/${validWalletAddress}/delegate`).send(updateData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('TxHashInvalid');
      expect(res.body.message).toBe('Invalid transaction hash format: not a hex string');
    });

    it('[400 Bad Request] : Should fail when delegated_tx is missing', async () => {
      const updateData = {};

      const res = await request(app).patch(`/member/${validWalletAddress}/delegate`).send(updateData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(0);
      expect(res.body.error).toBe('TxHashInvalid');
      expect(res.body.message).toBe('TxHash cannot be null or undefined');
    });
  });
});
