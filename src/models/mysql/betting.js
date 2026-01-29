module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'bettings',
    {
      betting_key: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('betting_key');
          return rawValue ? rawValue.toString() : null;
        },
      },
      betting_amount: {
        type: DataTypes.FLOAT(11),
        allowNull: false,
      },
      betting_tx: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      answer_key: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      quest_key: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      betting_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      reward_amount: {
        type: DataTypes.FLOAT(11),
        allowNull: false,
        defaultValue: 0.0,
      },
      betting_status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reward_claimed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      betting_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      reward_tx: {
        type: DataTypes.STRING(66),
        allowNull: true,
        defaultValue: null,
      },
      reward_created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      // New Solana-specific fields
      solana_transaction: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        comment: 'Solana transaction object for betting'
      },
      solana_bet_tokens: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        comment: 'Number of tokens bet on Solana'
      },
      solana_create_time: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        comment: 'Solana bet creation timestamp'
      },
      solana_reward_tokens: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        comment: 'Number of reward tokens available on Solana'
      },
      solana_receive_transaction: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        comment: 'Solana transaction object for receiving rewards'
      }
    },
    { timestamps: false, freezeTableName: true }
  );
};
