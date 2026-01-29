module.exports = (Sequelize, DataTypes) => {
    return Sequelize.define(
        'referrals',
        {
            wallet_address: { //foreign key to members table, wallet address
                type: DataTypes.STRING(64),
                allowNull: false,
                primaryKey: true,
            },
            referral_code: {
                type: DataTypes.STRING(10),//ID of referrer, foreign key to members table
                allowNull: false
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            }
        },
        { timestamps: false, freezeTableName: true }
    );
};
