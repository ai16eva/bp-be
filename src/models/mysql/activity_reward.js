module.exports = (Sequelize, DataTypes) => {
    return Sequelize.define(
        'activity_rewards',
        {
            id: {
                allowNull: false,
                autoIncrement: true,
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
            wallet_address: { //foreign key to members table, wallet address
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            reward_amount: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            reward_type: {
            type: DataTypes.ENUM('SIGNUP', 'DAILY_CHECKIN', 'CHECKIN_STREAK', "REFERRAL", "FIVE_REFERRAL"),
                allowNull: false,
                defaultValue: 'SIGNUP',
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            },
            rewarded_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            },
            reward_tx: {
                type: DataTypes.STRING(128),
                allowNull: true,
                defaultValue: null
            }
        },
        { timestamps: false, freezeTableName: true }
    );
};
