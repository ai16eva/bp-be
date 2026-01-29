const request = require('supertest');
const app = require('../../../app');

// Mock Governance SDK
jest.mock('../../config/solana', () => {
  const mockTransaction = () => ({
    // allow property assignment by controller
    serialize: () => Buffer.from('00', 'hex'),
  });
  const connection = {
    getRecentBlockhash: async () => ({ blockhash: 'TestBlockhash' }),
  };
  const sdk = {
    connection,
    pauseGovernance: async () => mockTransaction(),
    setMinimumNfts: async () => mockTransaction(),
    setMaxVotesPerVoter: async () => mockTransaction(),
    setQuestDurationHours: async () => mockTransaction(),
    setRewardAmount: async () => mockTransaction(),
    setTotalVote: async () => mockTransaction(),
    fetchConfig: async () => ({ mocked: true }),
    fetchGovernance: async () => ({ mocked: true }),
    fetchGovernanceItem: async () => ({ mocked: true }),
    fetchQuestVote: async () => ({ mocked: true }),
    fetchProposal: async () => ({ mocked: true }),
    initialize: async () => mockTransaction(),
    createCollection: async () => mockTransaction(),
    mintGovernanceNft: async () => ({ transaction: mockTransaction(), nftMint: { publicKey: { toBase58: () => 'MintPubkey' } } }),
    canCreateGovernanceItem: async () => true,
    createProposal: async () => mockTransaction(),
    setProposalResult: async () => mockTransaction(),
  };
  return {
    getGovernanceSDK: () => sdk,
  };
});

describe('Vote Controller - Solana Admin & Read endpoints', () => {
  const questKey = 123456;
  const base = `/quests/${questKey}/vote`;
  const validAuthority = '11111111111111111111111111111112';
  const validUser = '11111111111111111111111111111113';

  it('POST /admin/pause-governance -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/pause-governance`)
      .send({ pause: true, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('GET /admin/fetch-config -> 200 returns data', async () => {
    const res = await request(app)
      .get(`${base}/admin/fetch-config`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data).toBeDefined();
  });

  it('POST /admin/create-collection -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/create-collection`)
      .send({ name: 'COLL', symbol: 'COL', uri: 'https://meta', authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/submit-transaction-signature -> 200 accepted', async () => {
    const res = await request(app)
      .post(`${base}/admin/submit-transaction-signature`)
      .send({ signature: '5igSig', type: 'pause_governance', updateData: { any: 'thing' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
  });

  it('POST /admin/initialize-governance -> 200 returns transaction', async () => {
    const body = {
      minTotalVote: 1,
      maxTotalVote: 1000,
      minRequiredNft: 1,
      maxVotableNft: 10,
      durationHours: 24,
      constantRewardToken: 100,
      baseTokenMint: validAuthority,
      baseNftCollection: validAuthority,
      treasury: validAuthority,
      authority: validAuthority,
    };
    const res = await request(app)
      .post(`${base}/admin/initialize-governance`)
      .send(body);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/mint-governance-nft -> 200 returns transaction and mint', async () => {
    const res = await request(app)
      .post(`${base}/admin/mint-governance-nft`)
      .send({ name: 'NFT', symbol: 'NFT', uri: 'https://meta', user: validUser });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
    expect(res.body.data.nftMint).toBe('MintPubkey');
  });

  it('POST /admin/set-total-vote -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-total-vote`)
      .send({ minTotalVote: 1, maxTotalVote: 999, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/set-minimum-nfts -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-minimum-nfts`)
      .send({ minNfts: 2, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/set-max-votes-per-voter -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-max-votes-per-voter`)
      .send({ maxVotes: 3, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/set-quest-duration-hours -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-quest-duration-hours`)
      .send({ durationHours: 12, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/set-reward-amount -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-reward-amount`)
      .send({ rewardAmount: 50, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('GET /admin/fetch-governance-item/:quest_key -> 200 returns data', async () => {
    const res = await request(app)
      .get(`${base}/admin/fetch-governance-item/${questKey}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data).toBeDefined();
  });

  it('GET /admin/fetch-quest-vote/:quest_key -> 200 returns data', async () => {
    const res = await request(app)
      .get(`${base}/admin/fetch-quest-vote/${questKey}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data).toBeDefined();
  });

  it('GET /admin/fetch-proposal/:proposal_key -> 200 returns data', async () => {
    const res = await request(app)
      .get(`${base}/admin/fetch-proposal/1`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data).toBeDefined();
  });

  it('GET /admin/can-create-governance-item -> 200 returns allowed=true', async () => {
    const res = await request(app)
      .get(`${base}/admin/can-create-governance-item`)
      .query({ user: validUser });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.allowed).toBe(true);
  });

  it('POST /admin/create-proposal -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/create-proposal`)
      .send({ proposal_key: 1, title: 'Title', creator: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });

  it('POST /admin/set-proposal-result/:proposal_key -> 200 returns transaction', async () => {
    const res = await request(app)
      .post(`${base}/admin/set-proposal-result/1`)
      .send({ result: 'yes', resultVote: 10, authority: validAuthority });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.transaction).toBeDefined();
  });
});
