module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'governance_nft_owners',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      mint: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      token_account: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      owner_wallet: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    },
    { timestamps: false, freezeTableName: true }
  );
};


