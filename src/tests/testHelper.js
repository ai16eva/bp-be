const setupTestDB = (models) => {
  // Disable Sequelize logging
  beforeAll(async () => {
    models.sequelize.options.logging = false;
    try {
      // Sync all models to create tables if they don't exist
      await models.sequelize.sync({ force: false });
    } catch (error) {
      console.error('Failed to sync database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      await models.sequelize.transaction(async (transaction) => {
        // Disable foreign key checks
        await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

        // Get all model names
        const modelNames = Object.keys(models.sequelize.models);

        // Delete all records from each table
        for (const modelName of modelNames) {
          await models.sequelize.models[modelName].destroy({
            truncate: true,
            force: true,
            transaction,
          });
        }

        // Re-enable foreign key checks
        await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
      });
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await models.sequelize.close();
    } catch (error) {
      console.error('Failed to close database connection:', error);
      throw error;
    }
  });
};

module.exports = setupTestDB;
