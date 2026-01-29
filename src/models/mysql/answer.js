module.exports = (Sequelize, DataTypes) => {
  return Sequelize.define(
    'answers',
    {
      answer_key: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('answer_key');
            return rawValue ? rawValue.toString() : null;
        }
      },
      answer_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      answer_selected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      quest_key: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      answer_created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      answer_tx: {
        type: DataTypes.STRING(66),
        allowNull: true,
        defaultValue: null,
      },
      answer_pending: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    { timestamps: false, freezeTableName: true }
  );
};
