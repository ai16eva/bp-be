const request = require('supertest');
const app = require('../../../../app');
const client = require('../../../database/client');
const setupTestDB = require('../../testHelper');
const models = require('../../../models/mysql');
const Web3 = require('web3');

describe('Member Controller with Authorize', () => {
  const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const message = 'This is Test Message';
  let web3;
  setupTestDB(models);

  beforeAll(async () => {
    // Initialize Web3 with a provider (use a test network or local blockchain) -> trun on server locally
    web3 = new Web3('http://localhost:8545');
  });

  beforeEach(async () => {
    // Create test accounts
    adminAccount = web3.eth.accounts.create();
    nonAdminAccount = web3.eth.accounts.create();

    // Add test data to the database
    await models.members.create({
      wallet_address: adminAccount.address.toLowerCase(),
      member_role: 'ADMIN',
    });
    await models.members.create({
      wallet_address: nonAdminAccount.address.toLowerCase(),
      member_role: 'USER',
    });
    await models.members.create({
      wallet_address: testWalletAddress.toLowerCase(),
      member_role: 'ADMIN',
    });
  });

  describe('PATCH /member/role', () => {
    it('should update member role when admin requests: USER->ADMIN', async () => {
      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/role')
        .send({
          wallet_address: nonAdminAccount.address,
          role: 'ADMIN',
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Updated!');

      const updatedMember = await client.Member.Get(nonAdminAccount.address.toLowerCase());
      expect(updatedMember.member_role).toBe('ADMIN');
    });

    it('should update member role when admin requests: ADMIN->MEMBER', async () => {
      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/role')
        .send({
          wallet_address: testWalletAddress,
          role: 'USER',
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Updated!');

      const updatedMember = await client.Member.Get(testWalletAddress);
      expect(updatedMember.member_role).toBe('USER');
    });

    it('should fail when wallet address is empty', async () => {
      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/role')
        .send({
          role: 'ADMIN',
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WalletAddressInvalid');
    });

    it('should fail for invalid roles including empty string', async () => {
      const invalidRoles = ['', 'SUPERUSER', 'MODERATOR', '123'];
      const { signature } = adminAccount.sign(message);

      for (const invalidRole of invalidRoles) {
        const response = await request(app)
          .patch('/member/role')
          .send({
            wallet_address: nonAdminAccount.address,
            role: invalidRole,
          })
          .set('x-auth-message', message)
          .set('x-auth-signature', signature);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('MemberRoleInvalid');

        console.log(`Test passed for invalid role: "${invalidRole}"`);
      }
    });

    it('should fail when non-admin user tries to call this API', async () => {
      const { signature } = nonAdminAccount.sign(message);
      const response = await request(app)
        .patch('/member/role')
        .send({
          wallet_address: testWalletAddress,
          role: 'ADMIN',
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('AuthenticationInvalid');
    });
  });

  describe('PATCH /member/archive', () => {
    it('should archive a member successfully', async () => {
      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/archive')
        .send({
          wallet_address: testWalletAddress,
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Archived!');

      // Verify that the member is archived in the database
      const archivedMember = await client.Member.Get(testWalletAddress);
      expect(archivedMember.member_archived_at).toBeTruthy();
    });

    it('should fail when trying to archive a non-existent member', async () => {
      const { signature } = adminAccount.sign(message);
      const nonExistentAddress = '0x' + '1'.repeat(40);
      const response = await request(app)
        .patch('/member/archive')
        .send({
          wallet_address: nonExistentAddress,
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('MemberNotFound');
    });

    it('should fail when wallet address is missing', async () => {
      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/archive')
        .send({})
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    });

    it('should fail when non-admin tries to archive a member', async () => {
      const { signature } = nonAdminAccount.sign(message);
      const response = await request(app)
        .patch('/member/archive')
        .send({
          wallet_address: adminAccount.address,
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('AuthenticationInvalid');
    });
  });

  describe('PATCH /member/unarchive', () => {
    const tempWalletAddress = '0x0B978a3Efc7823e08F1CB1EF9862CeF3ecf2296a';
    beforeEach(async () => {
      await models.members.create({ wallet_address: tempWalletAddress.toLowerCase(), member_archived_at: new Date() });
    });
    it('should unarchive a member successfully', async () => {
      const beforeUnarchived = await client.Member.Get(tempWalletAddress);
      expect(beforeUnarchived.member_archived_at).toBeTruthy();

      const { signature } = adminAccount.sign(message);
      const response = await request(app)
        .patch('/member/unarchive')
        .send({
          wallet_address: tempWalletAddress,
        })
        .set('x-auth-message', message)
        .set('x-auth-signature', signature);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('unArchived!');

      // Verify that the member is unarchived in the database
      const unarchivedMember = await client.Member.Get(tempWalletAddress);
      expect(unarchivedMember.member_archived_at).toBeNull();
    });
  });
});
