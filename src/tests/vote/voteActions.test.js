const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');
const Vote = require('../../database/voteActions');

const ForbiddenAccess = require('../../exceptions/ForbiddenAccess');
const VoteDuplicate = require('../../exceptions/VoteDuplicate');
const VoteNotFound = require('../../exceptions/VoteNotFound');
const generateUniqueKey = require('../../utils/uniquekey_generate');

describe('Vote Model', () => {
  setupTestDB(models);
  let quest;
  let season;
  let season_category;
  let answer;
  let answer2;
  const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const testVoteData = { voter: testWalletAddress, power: 5, option: 'approve', tx: '0x' };

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
      quest_category_order: 1,
    };
    quest_category = await models.quest_categories.create(testSeasonCategoryDTO);

    const testQuestDTO = {
      quest_key: generateUniqueKey(),
      quest_title: 'Test Quest Title',
      quest_description: 'This is a test quest description that can be up to 2000 characters long.',
      quest_category_id: quest_category.quest_category_id,
      quest_creator: '0x1234567890123456789012345678901234567890',
      quest_image_url: 'https://example.com/test-quest-image.jpg',
      quest_image_link: 'https://example.com/test-quest-link',
      quest_start_date: new Date('2024-01-01'),
      quest_end_date: new Date('2024-12-31'),
      quest_end_date_utc: new Date(),
      season_id: season.season_id,
    };
    quest = await models.quests.create(testQuestDTO);

    const testAnswerDTO = {
      answer_key: generateUniqueKey(),
      answer_title: 'Test Answer',
      answer_selected: false,
      quest_key: quest.quest_key, // This should correspond to an existing question_key
    };
    const testAnswerDTO_2 = {
      answer_key: generateUniqueKey(),
      answer_title: 'Test Answer_2',
      answer_selected: false,
      quest_key: quest.quest_key, // This should correspond to an existing question_key
    };
    answer = await models.answers.create(testAnswerDTO);
    answer2 = await models.answers.create(testAnswerDTO_2);
  });

  describe.skip('Create', () => {
    it('should create a vote', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testWalletAddress },
      });
      expect(vote).not.toBeNull();
      expect(vote.vote_voter).toBe(testWalletAddress);
      expect(vote.vote_power).toBe(5);
    });

    it('should throw VoteDuplicate error for duplicate vote', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      await expect(Vote.Create(quest.quest_key, testVoteData)).rejects.toThrow(new VoteDuplicate());
    });
  });

  describe.skip('Get', () => {});

  describe('listVoteByVoter', () => {
    it('List vote by voter', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const answerData = { tx: '0x654321', answer_key: answer.answer_key };
      await Vote.UpdateAnswer(quest.quest_key, testVoteData.voter, answerData);
      await models.quests.update({ quest_status: 'MARKET_SUCCESS' }, { where: { quest_key: quest.quest_key } });
      // await models.answers.update({ answer_selected: 1 }, { where: answer.answer_key });

      const result = await Vote.listVoteByVoter('0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 10, 1);
      console.log(result);
    });
  });

  describe('UpdateReward', () => {
    it('should update reward', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      await Vote.UpdateReward(quest.quest_key, testVoteData.voter, 15);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });
      expect(vote.vote_reward).toBe(15);
    });

    it('should throw VoteNotFound for non-existent vote', async () => {
      await expect(Vote.UpdateReward('non-existent', 'non-existent')).rejects.toThrow(new VoteNotFound());
    });
  });

  describe.skip('UpdateSuccess', () => {
    it('should update success vote', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const successData = { tx: '0x123456', option: 'success-option' };
      await Vote.UpdateSuccess(quest.quest_key, testVoteData.voter, successData);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });
      expect(vote.vote_success_tx).toBe(successData.tx);
      expect(vote.vote_success_option).toBe(successData.option);
    });

    it('should throw ForbiddenAccess for already voted success', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const successData = { tx: '0x123456', option: 'success-option' };
      await Vote.UpdateSuccess(quest.quest_key, testVoteData.voter, successData);
      await expect(Vote.UpdateSuccess(quest.quest_key, testVoteData.voter, successData)).rejects.toThrow(
        new ForbiddenAccess('Already vote on Success')
      );
    });
  });

  describe.skip('UpdateAnswer', () => {
    it('should update answer vote', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const answerData = { tx: '0x654321', answer_key: answer.answer_key };
      await Vote.UpdateAnswer(quest.quest_key, testVoteData.voter, answerData);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });
      expect(vote.vote_answer_tx).toBe(answerData.tx);
      expect(BigInt(vote.quest_answer_key)).toBe(answerData.answer_key);
    });

    it('should throw ForbiddenAccess for already voted answer', async () => {
      await Vote.Create(quest.quest_key, testVoteData);
      const answerData = { tx: '0x654321', answer_key: answer.answer_key };
      await Vote.UpdateAnswer(quest.quest_key, testVoteData.voter, answerData);
      await expect(Vote.UpdateAnswer(quest.quest_key, testVoteData.voter, answerData)).rejects.toThrow(
        new ForbiddenAccess('Already vote on Answer')
      );
    });
  });

  describe.skip('Archive', () => {
    it('should archive a vote', async () => {
      const newVote = await Vote.Create(quest.quest_key, testVoteData);
      await Vote.Archive(newVote.vote_id, testVoteData.voter);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });
      expect(vote.vote_archived_at).not.toBeNull();
    });

    it('should throw VoteNotFound for non-existent vote', async () => {
      await expect(Vote.Archive('non-existent', 'non-existent')).rejects.toThrow(new VoteNotFound());
    });
  });

  describe.skip('Unarchive', () => {
    it('should unarchive a vote', async () => {
      const newVote = await Vote.Create(quest.quest_key, testVoteData);
      await Vote.Archive(newVote.vote_id, newVote.vote_voter);
      await Vote.Unarchive(newVote.vote_id, testVoteData.voter);
      const vote = await models.votes.findOne({
        where: { quest_key: quest.quest_key, vote_voter: testVoteData.voter },
      });
      expect(vote.vote_archived_at).toBeNull();
    });

    it('should throw VoteNotFound for non-existent vote', async () => {
      await expect(Vote.Unarchive('non-existent', 'non-existent')).rejects.toThrow(new VoteNotFound());
    });
  });
});
