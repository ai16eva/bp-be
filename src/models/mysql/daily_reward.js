module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'daily_rewards',
    {
      daily_reward_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      wallet_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      daily_reward_amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      claimed_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      daily_reward_tx: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      daily_reward_pending: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      daily_created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
      indexes: [
        {
          fields: ['wallet_address'],
        },
        {
          fields: ['claimed_at'],
        },
        {
          fields: ['wallet_address', 'claimed_at'],
          unique: true,
        },
      ],
    }
  );
};
