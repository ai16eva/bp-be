const QuestNotFound = require('../exceptions/quest/QuestNotFound');
const QuestCategoryInvalid = require('../exceptions/QuestCategoryInvalid');
const models = require('../models/mysql');
const SeasonNotFound = require('../exceptions/SeasonNotFound'); // Adjust the path as needed
const QuestCategory = models.quest_categories;

class QuestCategoryTransformer {
  static transform(category) {
    return {
      id: category.quest_category_id,
      title: category.quest_category_title,
      order: category.quest_category_order,
      createdAt: category.quest_category_created_at,
      archivedAt: category.quest_category_archived_at,
    };
  }

  static transformList(categories) {
    return categories.map((category) => this.transform(category));
  }
}

const questCategoryActions = {
  /**
   * @param {object} data
   * @returns {UUID} season_id
   */
  Create: async (data) => {
    const check = await QuestCategory.findOne({ where: { quest_category_title: data.title } });
    if (check) throw new QuestCategoryInvalid('Title duplicate');

    const categoryDTO = {
      quest_category_title: data.title,
      quest_category_order: data.order !== undefined ? data.order : null,
    };
    const category = await QuestCategory.create(categoryDTO);

    return category.category_id;
  },

  Update: async (quest_category_id, data) => {
    const updateDTO = {};
    const fields = ['title', 'order'];

    fields.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        updateDTO[`quest_category_${field}`] = data[field];
      }
    });
    if (Object.keys(updateDTO).length === 0) {
      throw new QuestCategoryInvalid('No valid fields provided for update');
    }

    await QuestCategory.update(updateDTO, { where: { quest_category_id } });
  },

  List: async (include_archived = false) => {
    const whereClause = include_archived ? {} : { quest_category_archived_at: null };
    const categories = await QuestCategory.findAll({
      where: whereClause,
      order: [['quest_category_order', 'ASC']],
    });

    return QuestCategoryTransformer.transformList(categories);
  },

  Get: async (quest_category_id) => {
    const category = await QuestCategory.findByPk(quest_category_id);
    return QuestCategoryTransformer.transform(category);
  },

  MustGet: async (quest_category_id) => {
    const category = await QuestCategory.findByPk(quest_category_id);

    if (!category) {
      throw new QuestNotFound('quest category not found');
    }

    return QuestCategoryTransformer.transform(season);
  },

  Archive: async (quest_category_id) => {
    const category = await QuestCategory.findByPk(quest_category_id);

    if (!category) {
      throw new QuestNotFound('quest category not found');
    }

    await category.update({ quest_category_archived_at: new Date() });
  },

  Unarchive: async (quest_category_id) => {
    const category = await QuestCategory.findByPk(quest_category_id);

    if (!category) {
      throw new QuestNotFound('quest category not found');
    }

    await category.update({ quest_category_archived_at: null });
  },
  GetCategoryByTitle: async (category_title) => {
    const category = await QuestCategory.findOne({ where: { quest_category_title: category_title } });
    if (!category) {
      throw new QuestCategoryInvalid();
    } else {
      return category;
    }
  },
};

module.exports = questCategoryActions;
