const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');
const Season = require('../../database/seasonActions');

const SeasonInvalidDataField = require('../../exceptions/SeasonInvalidDataField');
const SeasonNotFound = require('../../exceptions/SeasonNotFound');

describe('Season Model', () => {
  setupTestDB(models);

  it('should create a season', async () => {
    const seasonData = {
      title: 'Summer 2023',
      description: 'Summer season 2023',
      start_date: new Date('2023-06-01'),
      end_date: new Date('2023-08-31'),
      min_pay: 100,
      max_pay: 1000,
      service_fee: 10,
      charity_fee: 5,
      creator_fee: 15,
    };
    const newSeasonId = await Season.Create(seasonData);
    const newSeason = await Season.Get(newSeasonId);

    expect(newSeason.title).toBe('Summer 2023');
  });

  describe('Update', () => {
    it('should update season information successfully', async () => {
      const seasonData = {
        title: 'Winter 2023',
        description: 'Winter season 2023',
        start_date: new Date('2023-12-01'),
        end_date: new Date('2024-02-29'),
        min_pay: 200,
        max_pay: 2000,
        service_fee: 12,
        charity_fee: 6,
        creator_fee: 18,
      };

      const seasonId = await Season.Create(seasonData);

      const updateData = {
        title: 'Updated Winter 2023',
        description: 'Updated winter season 2023',
        min_pay: 250,
        max_pay: 2500,
      };

      await Season.Update(seasonId, updateData);

      const updatedSeason = await Season.Get(seasonId);

      expect(updatedSeason.title).toBe('Updated Winter 2023');
      expect(updatedSeason.description).toBe('Updated winter season 2023');
      expect(updatedSeason.minPay).toBe(250);
      expect(updatedSeason.maxPay).toBe(2500);
      // 업데이트하지 않은 필드들은 그대로 유지되어야 함
      expect(updatedSeason.startDate).toEqual(new Date('2023-12-01'));
      expect(updatedSeason.endDate).toEqual(new Date('2024-02-29'));
    });
  });

  describe('List', () => {
    it('should list all seasons with their categories', async () => {
      const season1Data = {
        title: 'Season 1',
        description: 'First season',
        start_date: new Date('2023-01-01'),
        end_date: new Date('2023-03-31'),
        min_pay: 100,
        max_pay: 1000,
        service_fee: 1,
        charity_fee: 5,
        creator_fee: 15,
      };

      const season2Data = {
        title: 'Season 2',
        description: 'Second season',
        start_date: new Date('2023-04-01'),
        end_date: new Date('2023-06-30'),
        min_pay: 200,
        max_pay: 2000,
        service_fee: 12,
        charity_fee: 6,
        creator_fee: 18,
      };

      await Season.Create(season1Data);
      await Season.Create(season2Data);

      const seasons = await Season.List();
      expect(seasons.length).toBe(2);
      expect(seasons[0].title).toBe('Season 1');
      expect(seasons[1].title).toBe('Season 2');
    });
  });

  describe('Get and MustGet', () => {
    it('should get a season by id with its categories', async () => {
      const seasonData = {
        title: 'Test Season',
        description: 'Test description',
        start_date: new Date('2023-07-01'),
        end_date: new Date('2023-09-30'),
        min_pay: 150,
        max_pay: 1500,
        service_fee: 0.11,
        charity_fee: 0.055,
        creator_fee: 0.165,
      };

      const seasonId = await Season.Create(seasonData);

      const season = await Season.Get(seasonId);

      expect(season.title).toBe('Test Season');
    });

    it('should throw SeasonNotFound if season does not exist for MustGet', async () => {
      await expect(Season.MustGet('non-existent-id')).rejects.toThrow(SeasonNotFound);
    });
  });

  describe('Active, Archive, and Unarchive', () => {
    let seasonId;

    beforeEach(async () => {
      const seasonData = {
        title: 'Archivable Season',
        description: 'Season for archive tests',
        start_date: new Date('2023-10-01'),
        end_date: new Date('2023-12-31'),
        min_pay: 300,
        max_pay: 3000,
        service_fee: 13,
        charity_fee: 6,
        creator_fee: 19,
      };

      seasonId = await Season.Create(seasonData);
    });

    it('should change active data as opposite by current value ', async () => {
      await Season.Active(seasonId);
      const activatedSeason = await Season.Get(seasonId);
      expect(activatedSeason.active).toBe(true);
    });
    it('should change active data as opposite by current value ', async () => {
      await Season.Active(seasonId);
      await Season.Active(seasonId);
      const checkSeason = await Season.Get(seasonId);
      expect(checkSeason.active).toBe(false);
    });

    it('should archive a season', async () => {
      await Season.Archive(seasonId);
      const archivedSeason = await models.seasons.findByPk(seasonId);
      expect(archivedSeason.season_archived_at).not.toBeNull();
    });

    it('should unarchive a season', async () => {
      await Season.Archive(seasonId);
      await Season.Unarchive(seasonId);
      const unarchivedSeason = await models.seasons.findByPk(seasonId);
      expect(unarchivedSeason.season_archived_at).toBeNull();
    });

    it('should throw SeasonNotFound when trying to archive non-existent season', async () => {
      await expect(Season.Archive('non-existent-id')).rejects.toThrow(new SeasonNotFound());
    });
  });
});
