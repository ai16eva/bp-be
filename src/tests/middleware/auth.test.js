const { adminAuth } = require('../../middlewares/authWeb3');
const Web3 = require('web3');
const { Member } = require('../../database/client');
const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');

describe('adminAuth Middleware', () => {
  let web3;
  let adminAccount;
  let nonAdminAccount;

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
  });

  const createRequest = (message, signature) => ({
    headers: {
      'x-auth-message': message,
      'x-auth-signature': signature,
    },
  });

  const createResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('should pass for valid admin authentication', async () => {
    const message = 'Test admin authentication';
    const { signature } = adminAccount.sign(message);
    const req = createRequest(message, signature);
    const res = createResponse();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.adminMember).toBeDefined();
    expect(req.adminMember.member_role).toBe('ADMIN');
  });

  it.skip('should throw AuthenticationInvalid when user is not an admin', async () => {
    const message = 'Test non-admin authentication';
    const { signature } = nonAdminAccount.sign(message);
    const req = createRequest(message, signature);
    const res = createResponse();
    const next = jest.fn();

    await adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'AuthenticationInvalid',
        message: 'Admin access required',
        success: 0,
      })
    );
  });

  it.skip('should throw AuthenticationInvalid for invalid signature', async () => {
    const message = 'Test admin authentication';
    const { signature } = adminAccount.sign('different message');

    const req = createRequest(message, signature);
    const res = createResponse();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MemberNotFound',
        message: 'Signature or message might wrong that Admin not found',
        success: 0,
      })
    );
  });

  it.skip('should throw AuthenticationInvalid when header not setting properly: message', async () => {
    const message = 'Test non-admin authentication';
    const { signature } = adminAccount.sign(message);
    const wrongReqHearder = (signature) => ({
      headers: {
        'x-auth-signature': signature,
      },
    });
    const req = wrongReqHearder(signature);
    const res = createResponse();
    const next = jest.fn();

    await adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'AuthenticationInvalid',
        message: 'No authentication data provided',
        success: 0,
      })
    );
  });

  it.skip('should throw AuthenticationInvalid when header not setting properly: signature', async () => {
    const message = 'Test non-admin authentication';
    const wrongReqHearder = (message) => ({
      headers: {
        'x-auth-message': message,
      },
    });
    const req = wrongReqHearder(message);
    const res = createResponse();
    const next = jest.fn();

    await adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'AuthenticationInvalid',
        message: 'No authentication data provided',
        success: 0,
      })
    );
  });
});
