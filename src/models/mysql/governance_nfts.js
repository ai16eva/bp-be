module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'governance_nfts',
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
        unique: true,
      },
      metadata_account: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      collection_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
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


