module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'members',
    {
      member_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      wallet_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      wallet_type: {
          type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'UNKNOWN',
      },

      member_role: {
        type: DataTypes.ENUM('USER', 'ADMIN'),
        allowNull: false,
        defaultValue: 'USER', //Allowed Values, USER, VIP, ADMIN
      },
      member_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      member_name: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      member_avatar: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      member_email_verified: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'F',
      },
      member_locked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      member_locked_tx: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      member_delegated_tx: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      member_created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      member_updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      member_archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    { timestamps: false, freezeTableName: true }
  );
};
