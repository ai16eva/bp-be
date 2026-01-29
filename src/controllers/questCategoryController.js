const { err, success } = require('../utils/responses');
const client = require('../database/client');

const { validateCategoryOption } = require('../validates/seasons');

module.exports = {
  createCategory: async (req, res) => {
    try {
      let { title, order } = req.body;
      const data = validateCategoryOption({ title, order });

      await client.QuestCategory.Create(data);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { quest_category_id } = req.params;
      const updateData = req.body;
      // data type would be title, order
      const data = validateCategoryOption(updateData);

      await client.QuestCategory.Update(quest_category_id, data);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  listCategory: async (req, res) => {
    try {
      const include_archived = req.query.include_archived === 'true' || req.query.include_archived === true;

      const categories = await client.QuestCategory.List(include_archived);
      res.status(200).json(success(categories));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  getCategory: async (req, res) => {
    try {
      const { quest_category_id } = req.params;
      const category = await client.QuestCategory.Get(quest_category_id);

      res.status(200).json(success(category));
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  archiveCategory: async (req, res) => {
    try {
      const { quest_category_id } = req.params;
      await client.QuestCategory.Archive(quest_category_id);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },

  unarchiveCategory: async (req, res) => {
    try {
      const { quest_category_id } = req.params;
      await client.QuestCategory.Unarchive(quest_category_id);
      res.status(200).json(success());
    } catch (e) {
      res.status(400).json(err(e));
    }
  },
};
