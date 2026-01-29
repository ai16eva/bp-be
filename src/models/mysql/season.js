module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'seasons',
    {
      season_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      season_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      season_description: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      service_fee: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      charity_fee: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      creator_fee: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      season_min_pay: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      season_max_pay: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      season_max_vote: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      season_dao_reward: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      season_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      season_start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      season_end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      season_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      season_archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    { timestamps: false, freezeTableName: true }
  );
};
