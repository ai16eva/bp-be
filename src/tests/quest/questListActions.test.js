const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');
const generateUniqueKey = require('../../utils/uniquekey_generate');
const Web3 = require('web3');

const QuestList = require('../../database/questListActions');
const Vote = require('../../database/voteActions');

describe('QuestList Model', () => {
  setupTestDB(models);
  let accounts;
  let web3;
  let quests = [];
  let season;
  let quest_category;
  let answer;
  let answer2;
  const message = 'This is Test Message';
  const getRandomPower = () => Math.floor(Math.random() * 5) + 1;
  beforeAll(async () => {
    let contract;
    // Initialize Web3 with a provider (use a test network or local blockchain) -> trun on server locally
    web3 = new Web3('http://localhost:8545');
    adminAccount = web3.eth.accounts.create();
    accounts = await web3.eth.getAccounts();
  });

  beforeEach(async () => {
    // Member & Admin create
    await models.members.create({
      wallet_address: accounts[0].toLowerCase(),
      member_role: 'ADMIN',
    });
    await models.members.create({
      wallet_address: accounts[1].toLowerCase(),
      member_role: 'USER',
    });
    await models.members.create({
      wallet_address: accounts[2].toLowerCase(),
      member_role: 'USER',
    });
    await models.members.create({
      wallet_address: accounts[3].toLowerCase(),
      member_role: 'USER',
    });
    await models.members.create({
      wallet_address: accounts[4].toLowerCase(),
      member_role: 'USER',
    });
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

    for (let i = 0; i < 30; i++) {
      const testQuestDTO = {
        quest_key: generateUniqueKey(),
        quest_title: `Test Quest Title ${i + 1}`,
        quest_description: `This is a test quest description ${i + 1} that can be up to 2000 characters long.`,
        quest_category_id: quest_category.quest_category_id,
        quest_creator: accounts[2].toLowerCase(),
        quest_image_url: `https://example.com/test-quest-image-${i + 1}.jpg`,
        quest_image_link: `https://example.com/test-quest-link-${i + 1}`,
        quest_start_date: new Date(2024, 0, i + 1), // 2024년 1월 1일부터 시작
        quest_end_date: new Date(2024, 11, 31 - i), // 2024년 12월 31일부터 역순으로
        quest_end_date_utc: new Date(Date.now() + i * 86400000), // 현재 시간부터 하루씩 증가
        season_id: season.season_id,
      };

      const quest = await models.quests.create(testQuestDTO);
      quests.push(quest.quest_key);
      // 각 퀘스트에 대해 두 개의 Answer 생성
      for (let j = 0; j < 2; j++) {
        const testAnswerDTO = {
          answer_key: generateUniqueKey(),
          answer_title: `Test Answer ${i + 1}-${j + 1}`,
          answer_description: `This is a description for Test Answer ${i + 1}-${j + 1}`,
          answer_selected: false,
          quest_key: quest.quest_key,
        };

        await models.answers.create(testAnswerDTO);
      }
    }
  }, 600000);
  describe.skip('ongoingList', () => {
    it('should list of onGoing quests', async () => {
      await models.quests.update({ quest_status: 'APPROVE' }, { where: { quest_key: quests[0] } });
      await models.quests.update({ quest_status: 'reject' }, { where: { quest_key: quests[1] } });
      await models.quests.update({ quest_status: 'dao_success' }, { where: { quest_key: quests[2] } });
      await models.quests.update({ quest_status: 'market_success' }, { where: { quest_key: quests[3] } });
      await models.quests.update({ quest_status: 'adjourn' }, { where: { quest_key: quests[4] } });

      const result = await QuestList.onGoingList();
      console.log(result);
      expect(result.length).toBe(7);
    });
  });
  describe.skip('draftList', () => {
    it('should list of Draf quests', async () => {
      await models.quests.update({ quest_status: 'APPROVE' }, { where: { quest_key: quests[0] } });
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 5; i++) {
        const temp = voteData();
        for (const j in temp) await Vote.Create(quests[i], temp[j]);
      }
      const result = await QuestList.draftList();
      console.log(result);
      expect(result.length).toBe(10);
    });
  });

  describe.skip('getPublishList', () => {
    it('should list of Publish quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 5; i++) {
        const temp = voteData();
        for (const j in temp) await Vote.Create(quests[i], temp[j]);
      }
      const result = await QuestList.draftList();
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          console.log(quest.quest_key);
          await models.quests.update({ quest_status: 'publish' }, { where: { quest_key: quest.quest_key } });
        }
      });
      await Promise.all(updatePromises);
      try {
        const publishRes = await QuestList.publishList();
        for (const v of publishRes) {
          const questWithAnswer = await models.quests.findOne({
            attributes: ['quest_key'],
            include: [
              {
                model: models.answers,
                as: 'answers',
                attributes: ['answer_key'],
              },
            ],
            where: {
              quest_key: v.quest_key,
            },
          });
          const answers = questWithAnswer.answers.map((answer) => answer.answer_key);
          for (const a of answers) {
            await models.bettings.create({
              betting_key: generateUniqueKey(),
              betting_amount: getRandomPower(),
              answer_key: a,
              quest_key: v.quest_key,
              betting_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            });
          }
        }
      } catch (e) {
        console.log(e);
      }
      const afterBettingRes = await QuestList.publishList();
      console.log(afterBettingRes);
      afterBettingRes.forEach((quest, index) => {
        expect(quest.total_betting_amount).toBeGreaterThan(0);
        console.log('quest_total_betting', quest.total_betting_amount);
      });
    });
  });
  describe.skip('getDecisionList', () => {
    it('should list of decision quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 3; i++) {
        const temp = voteData();
        for (const j in temp) {
          const vote = await Vote.Create(quests[i], temp[j]);
          await vote.update({ vote_success_option: vote.vote_power % 2 !== 1 ? 'success' : 'adjourn' });
        }
      }
      const result = await QuestList.draftList();
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          await models.quests.update(
            { quest_status: 'finish', dao_success_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
        }
      });
      await Promise.all(updatePromises);
      const deicisionRes = await QuestList.deicisionList();
      console.log(deicisionRes);
      deicisionRes.forEach((quest, index) => {
        expect(quest.total_vote).toBeGreaterThan(0);
        expect(quest.quest_status).toBe('FINISH');
      });
    });
  });
  describe.skip('getAnswerList', () => {
    it('should list of answer quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 10; i++) {
        const temp = voteData();
        for (const j in temp) {
          const vote = await Vote.Create(quests[i], temp[j]);
          await vote.update({ vote_success_option: vote.vote_power % 2 !== 1 ? 'success' : 'adjourn' });
        }
      }
      const result = await QuestList.draftList();
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          await models.quests.update(
            { quest_status: 'finish', dao_success_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
        } else {
          await models.quests.update({ quest_status: 'adjourn' }, { where: { quest_key: quest.quest_key } });
        }
      });
      await Promise.all(updatePromises);
      const decisionRes = await QuestList.deicisionList();
      let count = 0;
      const updateDecPromises = decisionRes.map(async (quest) => {
        if (quest.total_success_power > quest.total_adjourn_power) {
          await models.quests.update(
            { quest_status: 'dao_success', dao_answer_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
          count++;
        }
      });
      await Promise.all(updateDecPromises);
      try {
        const answerRes = await QuestList.answerList();
        expect(answerRes.length).toBe(count);
        const updateVotesForAnswers = async (answerRes, limit = 3) => {
          try {
            let globalOffset = 0;

            for (const quest of answerRes) {
              for (const answer of quest.answers) {
                const votes = await models.votes.findAll({
                  where: {
                    quest_key: quest.quest_key,
                    quest_answer_key: null,
                  },
                  offset: globalOffset,
                  limit: limit,
                });

                if (votes.length === 0) {
                  console.log('No more votes to assign');
                  return; // 또는 break를 사용하여 외부 루프를 종료할 수 있습니다.
                }
                const updatePromises = votes.map((v) => v.update({ quest_answer_key: answer.answer_key }));
                await Promise.all(updatePromises);

                console.log(
                  `Updated votes for answer ${answer.answer_key}, offset: ${globalOffset}, votes assigned: ${votes.length}`
                );
              }
            }

            console.log('All answers processed. Final offset:', globalOffset);
          } catch (e) {
            console.error('Error updating answers:', e);
            throw e;
          }
        };

        await updateVotesForAnswers(answerRes);
        const answerResAfter = await QuestList.answerList();
        console.log(answerResAfter);
        answerResAfter.forEach((quest) => {
          console.log(quest.answers);
          expect(quest.total_vote).toBeGreaterThan(0);
          quest.answers.forEach((answer) => {
            expect(answer.vote_power).toBeGreaterThan(0);
          });
        });
      } catch (e) {
        console.error('Error updating answers:', e);
      }
    });
  });
  describe('getSuccessList', () => {
    it('should list of success quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 20; i++) {
        const temp = voteData();
        for (const j in temp) {
          const vote = await Vote.Create(quests[i], temp[j]);
          await vote.update({
            vote_success_option: vote.vote_power % 2 !== 1 ? 'success' : 'adjourn',
            vote_success_tx: `0x${i}`,
          });
        }
      }

      const result = await QuestList.draftList((limit = 30));
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          await models.quests.update(
            { quest_status: 'finish', dao_success_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
        } else {
          if (
            (quest.total_approve_power + quest.total_reject_power) % 2 != 1 &&
            quest.total_approve_power + quest.total_reject_power !== 0
          ) {
            await models.quests.update(
              { quest_status: 'publish', quest_publish_tx: '0x00' },
              { where: { quest_key: quest.quest_key } }
            );
          } else if (quest.total_approve_power + quest.total_reject_power == 0) {
            console.log('skip');
          } else if (quest.total_approve_power + quest.total_reject_power !== 0) {
            await models.quests.update(
              { quest_status: 'adjourn', quest_adjourn_tx: '0x001' },
              { where: { quest_key: quest.quest_key } }
            );
          }
        }
      });
      await Promise.all(updatePromises);
      const decisionRes = await QuestList.deicisionList();
      let count = 0;
      const updateDecPromises = decisionRes.map(async (quest) => {
        if (quest.total_success_power > quest.total_adjourn_power) {
          await models.quests.update(
            { quest_status: 'dao_success', dao_answer_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
          count++;
        }
      });
      await Promise.all(updateDecPromises);
      try {
        const answerRes = await QuestList.answerList();
        expect(answerRes.length).toBe(count);
        const updateVotesForAnswers = async (answerRes, limit = 3) => {
          try {
            let globalOffset = 0;

            for (const quest of answerRes) {
              for (const answer of quest.answers) {
                const votes = await models.votes.findAll({
                  where: {
                    quest_key: quest.quest_key,
                    quest_answer_key: null,
                  },
                  offset: globalOffset,
                  limit: limit,
                });

                if (votes.length === 0) {
                  console.log('No more votes to assign');
                  return; // 또는 break를 사용하여 외부 루프를 종료할 수 있습니다.
                }
                const updatePromises = votes.map((v) => v.update({ quest_answer_key: answer.answer_key }));
                await Promise.all(updatePromises);

                console.log(
                  `Updated votes for answer ${answer.answer_key}, offset: ${globalOffset}, votes assigned: ${votes.length}`
                );
              }
            }

            console.log('All answers processed. Final offset:', globalOffset);
          } catch (e) {
            console.error('Error updating answers:', e);
            throw e;
          }
        };

        await updateVotesForAnswers(answerRes);
        const answerResAfter = await QuestList.answerList();
        const tempAnswers = [];
        answerResAfter.forEach(async (quest) => {
          quest.answers.forEach((answer) => tempAnswers.push([quest.quest_key, answer.answer_key]));
        });
        for (const a of tempAnswers) {
          await models.quests.update({ quest_status: 'MARKET_SUCCESS' }, { where: { quest_key: a[0] } });
          const betAmount = getRandomPower();
          await models.bettings.create({
            betting_key: generateUniqueKey(),
            betting_amount: betAmount,
            answer_key: a[1],
            quest_key: a[0],
            betting_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          });
        }
        const successRes = await QuestList.successList();
        console.log(successRes);
      } catch (e) {
        console.error('Error updating answers:', e);
      }
    });
  });
  describe.skip('getAdjournList', () => {
    it('should list of Adjourn quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 5; i++) {
        const temp = voteData();
        for (const j in temp) await Vote.Create(quests[i], temp[j]);
      }
      const result = await QuestList.draftList();
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          await models.quests.update({ quest_status: 'publish' }, { where: { quest_key: quest.quest_key } });
        } else {
          await models.quests.update({ quest_status: 'reject' }, { where: { quest_key: quest.quest_key } });
        }
      });
      await Promise.all(updatePromises);
      try {
        const publishRes = await QuestList.publishList();
        for (const v of publishRes) {
          const questWithAnswer = await models.quests.findOne({
            attributes: ['quest_key'],
            include: [
              {
                model: models.answers,
                as: 'answers',
                attributes: ['answer_key'],
              },
            ],
            where: {
              quest_key: v.quest_key,
            },
          });
          const answers = questWithAnswer.answers.map((answer) => answer.answer_key);
          for (const a of answers) {
            await models.bettings.create({
              betting_key: generateUniqueKey(),
              betting_amount: getRandomPower(),
              answer_key: a,
              quest_key: v.quest_key,
              betting_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            });
          }
        }
      } catch (e) {
        console.log(e);
      }
      const afterBettingRes = await QuestList.publishList();
      const updateBetPromises = afterBettingRes.map(async (quest) => {
        await models.quests.update({ quest_status: 'adjourn' }, { where: { quest_key: quest.quest_key } });
      });
      await Promise.all(updateBetPromises);

      const adjournRes = await QuestList.adjournList();
      console.log(adjournRes);
    });
  });

  describe.skip('draftListAtDaopage', () => {
    it('should list of Draf quests', async () => {
      await models.quests.update({ quest_status: 'APPROVE' }, { where: { quest_key: quests[0] } });
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 5; i++) {
        const temp = voteData();
        for (const j in temp) await Vote.Create(quests[i], temp[j]);
      }
      const result = await QuestList.draftListAtDaoPage();
      console.log(result);
      for (const r of result) {
        console.log(r.answers);
      }
      expect(result.length).toBe(9);
    });
  });
  describe.skip('successListAtDaopage', () => {
    it('should list of success quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 5; i++) {
        const temp = voteData();
        for (const j in temp) {
          const vote = await Vote.Create(quests[i], temp[j]);
          await vote.update({ vote_success_option: vote.vote_power % 2 !== 1 ? 'success' : 'adjourn' });
        }
      }
      const result = await QuestList.draftListAtDaoPage();
      for (const r of result) {
        await models.quests.update({ quest_status: 'finish' }, { where: { quest_key: r.quest_key } });
      }

      try {
        const publishRes = await QuestList.publishList();
        for (const p of publishRes)
          await models.quests.update({ dao_success_tx: '0x20' }, { where: { quest_key: p.quest_key } });
        for (const v of publishRes) {
          const questWithAnswer = await models.quests.findOne({
            attributes: ['quest_key'],
            include: [
              {
                model: models.answers,
                as: 'answers',
                attributes: ['answer_key'],
              },
            ],
            where: {
              quest_key: v.quest_key,
            },
          });
          const answers = questWithAnswer.answers.map((answer) => answer.answer_key);
          for (const a of answers) {
            await models.bettings.create({
              betting_key: generateUniqueKey(),
              betting_amount: getRandomPower(),
              answer_key: a,
              quest_key: v.quest_key,
              betting_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            });
          }
        }
      } catch (e) {
        console.log(e);
      }
      const successListRes = await QuestList.successListAtDaoPage();
      console.log(successListRes);
      for (const s of successListRes) {
        console.log(s.answers);
      }
    });
  });
  describe.skip('answerListatDaoPage', () => {
    it('should list of answer quests', async () => {
      const voteData = () => {
        return [
          { voter: accounts[0], power: getRandomPower(), option: 'approve', tx: '0x1' },
          { voter: accounts[1], power: getRandomPower(), option: 'approve', tx: '0x2' },
          { voter: accounts[2], power: getRandomPower(), option: 'approve', tx: '0x3' },
          { voter: accounts[3], power: getRandomPower(), option: 'reject', tx: '0x4' },
          { voter: accounts[4], power: getRandomPower(), option: 'reject', tx: '0x5' },
        ];
      };
      for (let i = 0; i < 15; i++) {
        const temp = voteData();
        for (const j in temp) {
          const vote = await Vote.Create(quests[i], temp[j]);
          await vote.update({
            vote_success_option: vote.vote_power % 2 !== 1 ? 'success' : 'adjourn',
            vote_success_tx: `0x${i}`,
          });
        }
      }

      const result = await QuestList.draftList((limit = 30));
      const updatePromises = result.map(async (quest) => {
        if (quest.total_approve_power > quest.total_reject_power) {
          await models.quests.update(
            { quest_status: 'finish', dao_success_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
        } else {
          if (
            (quest.total_approve_power + quest.total_reject_power) / 2 != 1 &&
            quest.total_approve_power + quest.total_reject_power !== 0
          ) {
            await models.quests.update(
              { quest_status: 'publish', quest_publish_tx: '0x00' },
              { where: { quest_key: quest.quest_key } }
            );
          } else if (quest.total_approve_power + quest.total_reject_power == 0) {
            console.log('skip');
          } else {
            await models.quests.update(
              { quest_status: 'adjourn', quest_adjourn_tx: '0x001' },
              { where: { quest_key: quest.quest_key } }
            );
          }
        }
      });
      await Promise.all(updatePromises);
      const decisionRes = await QuestList.deicisionList();
      let count = 0;
      const updateDecPromises = decisionRes.map(async (quest) => {
        if (quest.total_success_power > quest.total_adjourn_power) {
          await models.quests.update(
            { quest_status: 'dao_success', dao_answer_tx: '0x9' },
            { where: { quest_key: quest.quest_key } }
          );
          count++;
        }
      });
      await Promise.all(updateDecPromises);
      try {
        const answerRes = await QuestList.answerList();
        expect(answerRes.length).toBe(count);
        const updateVotesForAnswers = async (answerRes, limit = 3) => {
          try {
            let globalOffset = 0;

            for (const quest of answerRes) {
              for (const answer of quest.answers) {
                const votes = await models.votes.findAll({
                  where: {
                    quest_key: quest.quest_key,
                    quest_answer_key: null,
                  },
                  offset: globalOffset,
                  limit: limit,
                });

                if (votes.length === 0) {
                  console.log('No more votes to assign');
                  return; // 또는 break를 사용하여 외부 루프를 종료할 수 있습니다.
                }
                const updatePromises = votes.map((v) =>
                  v.update({ quest_answer_key: answer.answer_key, vote_answer_tx: '0x002' })
                );
                await Promise.all(updatePromises);

                console.log(
                  `Updated votes for answer ${answer.answer_key}, offset: ${globalOffset}, votes assigned: ${votes.length}`
                );
              }
            }

            console.log('All answers processed. Final offset:', globalOffset);
          } catch (e) {
            console.error('Error updating answers:', e);
            throw e;
          }
        };

        await updateVotesForAnswers(answerRes);
        const answerResAfter = await QuestList.answerList();
        const tempAnswers = [];
        answerResAfter.forEach(async (quest) => {
          quest.answers.forEach((answer) => tempAnswers.push([quest.quest_key, answer.answer_key]));
        });
        for (const a of tempAnswers) {
          const betAmount = getRandomPower();
          await models.bettings.create({
            betting_key: generateUniqueKey(),
            betting_tx: '0x222',
            betting_amount: betAmount,
            answer_key: a[1],
            quest_key: a[0],
            betting_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          });
        }
        const list = await QuestList.answerListAtDaoPage();
        console.log(list);
        for (const l of list) {
          console.log(l.answers);
        }
      } catch (e) {
        console.error('Error updating answers:', e);
      }
    });
  });
});
