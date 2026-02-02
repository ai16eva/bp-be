/**
 * Rewards Model
 * Centralized table for tracking all types of rewards (betting, creator, etc.)
 */
module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'rewards',
    {
      reward_key: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('reward_key');
          return rawValue ? rawValue.toString() : null;
        },
      },
      wallet_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'Wallet address that receives the reward',
      },
      quest_key: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'Quest key associated with this reward',
      },
      answer_key: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
        comment: 'Answer key (for betting rewards), null for creator rewards',
      },
      betting_key: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
        comment: 'Betting key (if reward is from betting)',
      },
      reward_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0.0,
        comment: 'Reward amount in tokens',
      },
      reward_type: {
        type: DataTypes.ENUM('bettingReward', 'creatorReward', 'charityReward', 'serviceReward', 'other'),
        allowNull: false,
        defaultValue: 'bettingReward',
        comment: 'Type of reward: bettingReward, creatorReward, charityReward, serviceReward, etc.',
      },
      reward_claimed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the reward has been claimed',
      },
      reward_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
        comment: 'Transaction hash when reward was distributed/claimed',
      },
      reward_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'When the reward was created/calculated',
      },
      reward_claimed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'When the reward was claimed',
      },
      // Solana-specific fields
      solana_reward_tokens: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        comment: 'Number of reward tokens on Solana',
      },
      solana_reward_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
        comment: 'Solana transaction hash for reward distribution',
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
      indexes: [
        {
          name: 'idx_rewards_wallet',
          fields: ['wallet_address'],
        },
        {
          name: 'idx_rewards_quest',
          fields: ['quest_key'],
        },
        {
          name: 'idx_rewards_claimed',
          fields: ['reward_claimed'],
        },
        {
          name: 'idx_rewards_type',
          fields: ['reward_type'],
        },
        {
          name: 'idx_rewards_wallet_quest',
          fields: ['wallet_address', 'quest_key'],
        },
      ],
    }
  );
};

