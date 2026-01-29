const { err, success } = require('../utils/responses');
const client = require('../database/client');

const {
  validateTitle,
  validateDescription,
  validateStartDate,
  validateEndDate,
  validateMinPay,
  validateMaxPay,
  validateServiceFee,
  validateCharityFee,
  validateCreatorFee,
  validateUpdateData,
  validateMaxVotes,
  validateDaoReward,
} = require('../validates/seasons');

const { GetQuestCountBySeasonAndCategory } = require('../database/questActions');

module.exports = {
  createSeason: async (req, res) => {
    try {
      let {
        title,
        description,
        start_date,
        end_date,
        min_pay,
        max_pay,
        service_fee,
        charity_fee,
        creator_fee,
        max_vote,
        dao_reward,
      } = req.body;

      title = validateTitle(title);
      description = validateDescription(description);
      start_date = validateStartDate(start_date);
      end_date = validateEndDate(end_date);
      min_pay = validateMinPay(min_pay);
      max_pay = validateMaxPay(max_pay);
      service_fee = validateServiceFee(service_fee);
      charity_fee = validateCharityFee(charity_fee);
      creator_fee = validateCreatorFee(creator_fee);
      max_vote = validateMaxVotes(max_vote);
      dao_reward = validateDaoReward(dao_reward);

      const season_id = await client.Season.Create({
        title,
        description,
        start_date,
        end_date,
        min_pay,
        max_pay,
        service_fee,
        charity_fee,
        creator_fee,
        max_vote,
        dao_reward,
      });
      res.status(200).json(success(season_id));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  updateSeason: async (req, res) => {
    try {
      const { season_id } = req.params;
      const updateData = req.body;
      const data = validateUpdateData(updateData);

      await client.Season.Update(season_id, data);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  listSeasons: async (req, res) => {
    try {
      const seasons = await client.Season.List();
      res.status(200).json(success(seasons));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  getActiveSeason: async (req, res) => {
    try {
      const season = await client.Season.GetActive();
      if (season === null) return res.status(202).json(success(null, 'Active season is multiple'));
      else return res.status(200).json(success(season));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  getSeason: async (req, res) => {
    try {
      const { season_id } = req.params;
      const season = await client.Season.Get(season_id);

      res.status(200).json(success(season));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  updateSeasonActive: async (req, res) => {
    try {
      const { season_id } = req.params;
      await client.Season.Active(season_id);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  archiveSeason: async (req, res) => {
    try {
      const { season_id } = req.params;
      await client.Season.Archive(season_id);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  unarchiveSeason: async (req, res) => {
    try {
      const { season_id } = req.params;
      await client.Season.Unarchive(season_id);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  listSeasonWithQuestCount: async (req, res) => {
    try {
      const result = await GetQuestCountBySeasonAndCategory();
      res.status(200).json(success(result));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
};
