module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'quests',
    {
      quest_key: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('quest_key');
          return rawValue ? rawValue.toString() : null;
        },
      },
      quest_title: {
        type: DataTypes.STRING(1000),
        allowNull: false,
      },
      quest_description: {
        type: DataTypes.STRING(2000),
        allowNull: false,
      },
      season_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quest_category_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quest_creator: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      quest_betting_token: {
        type: DataTypes.ENUM(
          'BOOM',
          "USDT",
          "WSOL",
          "USDC"
        ),
        allowNull: false,
        defaultValue: 'BOOM'
      },
      quest_betting_token_address: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
      },
      quest_image_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      quest_image_link: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      quest_end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      quest_end_date_utc: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      quest_hot: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      quest_status: {
        type: DataTypes.ENUM(
          'DRAFT',
          'APPROVE',
          'REJECT',
          'PUBLISH',
          'FINISH',
          'DAO_SUCCESS',
          'MARKET_SUCCESS',
          'ADJOURN'
        ),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      quest_publish_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      quest_publish_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      quest_finish_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      quest_finish_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      quest_adjourn_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      quest_adjourn_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      quest_success_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      quest_success_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      quest_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      quest_updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      quest_archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.fn('NOW'),
      },
      dao_created_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      dao_draft_start_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_draft_end_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_draft_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      dao_success_start_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_success_end_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_success_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      dao_answer_start_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_answer_end_at: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      dao_answer_tx: {
        type: DataTypes.TEXT, // Solana transaction hash usually ~88 characters, use TEXT to ensure sufficient length
        allowNull: true,
        defaultValue: null,
      },
      quest_pending: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      quest_reward_calculated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      quest_retrieve_tx: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      quest_retrieved_token: {
        type: DataTypes.FLOAT(11),
        allowNull: true,
      },
      quest_start_block: {
        type: DataTypes.INTEGER,
        defaultValue: null,
        allowNull: true,
      },
    },
    { timestamps: false, freezeTableName: true }
  );
};
