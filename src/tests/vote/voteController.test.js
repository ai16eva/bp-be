const request = require('supertest');
const path = require('path');
const app = require('../../../app');
const client = require('../../database/client');
const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');
const generateUniqueKey = require('../../utils/uniquekey_generate');

describe('Vote Controller', () => {
  setupTestDB(models);
  let quest;
  let season;
  let quest_category;
  let answer;
  const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const testVoteData = {
    voter: testWalletAddress,
    power: 5,
    option: 'approve',
    tx: '0x1234567890123456789012345678901234567890123456789012345678901234',
  };

  beforeEach(async () => {
    const testSeasonDTO = {
      season_title: 'Test Season 2024',
      season_description: 'This is a test season for the year 2024.',
      service_fee: 5, // Assuming this is a percentage
      charity_fee: 2, // Assuming this is a percentage
      creator_fee: 3, // Assuming this is a percentage
      season_min_pay: 100, // Minimum payment in smallest unit of currency (e.g., cents)
      season_max_pay: 10000, // Maximum payment in smallest unit of currency
      season_active: true,
      season_start_date: new Date('2024-01-01'),
      season_end_date: new Date('2024-12-31'),
    };

    season = await models.seasons.create(testSeasonDTO);

    const testSeasonCategoryDTO = {
      quest_category_title: 'Test Category',
      season_id: season.season_id, // This should correspond to an existing season_id
      quest_category_order: 1,
    };
    quest_category = await models.quest_categories.create(testSeasonCategoryDTO);

    const testQuestDTO = {
      quest_key: generateUniqueKey(),
      quest_title: 'Test Quest Title',
      quest_description: 'This is a test quest description that can be up to 2000 characters long.',
      quest_category_id: quest_category.quest_category_id,
      season_id: season.season_id,
      quest_creator: '0x1234567890123456789012345678901234567890',
      quest_image_url: 'https://example.com/test-quest-image.jpg',
      quest_image_link: 'https://example.com/test-quest-link',
      quest_start_date: new Date('2024-01-01'),
      quest_end_date: new Date('2024-12-31'),
      quest_end_date_utc: new Date(),
    };
    quest = await models.quests.create(testQuestDTO);

    const testAnswerDTO = {
      answer_key: generateUniqueKey(),
      answer_title: 'Test Answer',
      answer_selected: false,
      quest_key: quest.quest_key, // This should correspond to an existing question_key
    };
    answer = await models.answers.create(testAnswerDTO);
  });

  describe('POST /quests/:quest_key/votes', () => {
    it('[200 OK] : Must create one Vote', async () => {
      const res = await request(app).post(`/quests/${quest.quest_key}/vote`).send(testVoteData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });

      expect(testWalletAddress.toLowerCase()).toBe(vote.vote_voter);
    });

    it('[200 OK] : If vote is duplicate, return success', async () => {
      const res = await request(app).post(`/quests/${quest.quest_key}/vote`).send(testVoteData);

      const res_2 = await request(app).post(`/quests/${quest.quest_key}/vote`).send(testVoteData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      expect(res_2.statusCode).toBe(200)
      expect(res_2.body.success).toBe(1);
    });
  });

  describe('PATCH /quests/:quest_key/votes/:voter/success', () => {
    it('[200 OK] : Must update vote success tx, success option', async () => {
      await request(app).post(`/quests/${quest.quest_key}/vote`).send(testVoteData);

      const res = await request(app)
        .patch(`/quests/${quest.quest_key}/vote/${testVoteData.voter}/success`)
        .send({ option: 'SUCCESS', tx: testVoteData.tx });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(1);

      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });

      expect(testVoteData.tx).toBe(vote.vote_success_tx);
    });
  });

  describe.skip('PATCH /quests/:quest_key/votes/:voter/answer', () => {});
  describe.skip('PATCH /quests/:quest_key/votes/:voter/reward', () => {});
  describe.skip('PATCH /quests/:quest_key/votes/:voter/archive', () => {});
  describe.skip('PATCH /quests/:quest_key/votes/:voter/unarchive', () => {});
});
