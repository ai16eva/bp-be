const SeasonNotFound = require('../exceptions/SeasonNotFound');
const models = require('../models/mysql');
const Season = models.seasons;

class SeasonTransformer {
  static transform(season) {
    return {
      id: season.season_id,
      title: season.season_title,
      description: season.season_description,
      startDate: season.season_start_date,
      endDate: season.season_end_date,
      serviceFee: season.service_fee,
      charityFee: season.charity_fee,
      creatorFee: season.creator_fee,
      minPay: season.season_min_pay,
      maxPay: season.season_max_pay,
      maxVote: season.season_max_vote,
      daoReward: season.season_dao_reward,
      active: season.season_active,
    };
  }

  static transformList(seasons) {
    return seasons.map(this.transform);
  }
}

const seasonActions = {
  /**
   *
   * @param {object} data
   * @returns {UUID} season_id
   */
  Create: async (data) => {
    const createDTO = {
      season_title: data.title,
      season_description: data.description,
      season_start_date: data.start_date,
      season_end_date: data.end_date,
      season_min_pay: data.min_pay,
      season_max_pay: data.max_pay,
      service_fee: data.service_fee,
      charity_fee: data.charity_fee,
      creator_fee: data.creator_fee,
      season_max_vote: data.max_vote,
      season_dao_reward: data.dao_reward,
    };

    const season = await Season.create(createDTO);

    return season.season_id;
  },

  Update: async (season_id, data) => {
    const season = await season.findByPk(season_id);
    if (!season) throw new SeasonNotFound();
    const updateDTO = {};
    const fields = ['title', 'description', 'start_date', 'end_date', 'max_pay', 'min_pay', 'max_vote', 'dao_reward'];
    const others = ['service_fee', 'charity_fee', 'creator_fee'];
    fields.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        updateDTO[`season_${field}`] = data[field];
      }
    });
    others.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        updateDTO[`${field}`] = data[field];
      }
    });
    if (Object.keys(updateDTO).length !== 0) {
      await season.update(updateDTO);
    }
  },

  List: async () => {
    const seasons = await Season.findAll({
      order: [['season_created_at', 'ASC']],
    });
    return SeasonTransformer.transformList(seasons);
  },

  Get: async (season_id) => {
    const season = await Season.findByPk(season_id);
    return SeasonTransformer.transform(season);
  },

  MustGet: async (season_id) => {
    const season = await Season.findByPk(season_id);

    if (!season) {
      throw new SeasonNotFound();
    }

    return SeasonTransformer.transform(season);
  },

  GetActive: async () => {
    const seasons = await Season.findAll({ where: { season_active: true } });
    if (seasons.length === 0) throw new SeasonNotFound('No active Season');
    if (seasons.length > 1) return null;
    else return SeasonTransformer.transform(seasons[0]);
  },

  Active: async (season_id) => {
    let bool;
    const season = await Season.findByPk(season_id);
    bool = season.season_active ? false : true;
    await season.update({ season_active: bool });
  },

  Archive: async (season_id) => {
    const season = await Season.findByPk(season_id);

    if (!season) {
      throw new SeasonNotFound();
    }

    await season.update({ season_archived_at: new Date() });
  },

  Unarchive: async (season_id) => {
    const season = await Season.findByPk(season_id);

    if (!season) {
      throw new SeasonNotFound();
    }

    await season.update({ season_archived_at: null });
  },
  GetSeasonByTitle: async (season_title) => {
    const season = await Season.findOne({ where: { season_title } });
    if (!season) {
      throw new SeasonNotFound();
    } else {
      return season;
    }
  },
};

module.exports = seasonActions;
