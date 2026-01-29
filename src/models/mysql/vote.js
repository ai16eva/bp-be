module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'votes',
    {
      vote_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      quest_key: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      vote_voter: {
        type: DataTypes.STRING(64),
        allowNull: false,  
      },
      vote_voter_nft_account: {
        type: DataTypes.STRING(88),
        allowNull: true,
      },
      vote_power: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      vote_draft_option: {
        type: DataTypes.ENUM('APPROVE', 'REJECT'),
        allowNull: true,
        defaultValue: null,
      },
      vote_draft_tx: {
        type: DataTypes.TEXT, 
        allowNull: true,
        defaultValue: 'pending',
      },
      vote_success_option: {
        type: DataTypes.ENUM('SUCCESS', 'ADJOURN'),
        defaultValue: null,
      },
      vote_success_tx: {
        type: DataTypes.TEXT, 
      },
      quest_answer_key: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      vote_answer_tx: {
        type: DataTypes.TEXT, // Solana transaction hash usually ~88 characters, use TEXT to ensure sufficient length
        allowNull: true,
      },
      vote_reward: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      vote_archived_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      vote_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    },
    {
      underscored: true,
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['quest_key', 'vote_voter'],
        },
      ],
    }
  );
};
