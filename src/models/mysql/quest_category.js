module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'quest_categories',
    {
      quest_category_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      quest_category_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      quest_category_order: {
        type: DataTypes.INTEGER,
        defaultValue: null,
      },
      quest_category_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      quest_category_archived_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
    },
    { timestamps: false, freezeTableName: true }
  );
};
