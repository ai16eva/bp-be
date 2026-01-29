module.exports = (Sequelize, DataTypes) => {
    return Sequelize.define(
        'referral_codes',
        {
            wallet_address: { //foreign key to members table, wallet address
                type: DataTypes.STRING(64),
                allowNull: false,
                primaryKey: true,
            },
            referral_code: {
                type: DataTypes.STRING(10),
                allowNull: false,
                primaryKey: true,
            },
            five_referral_rewarded_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            },
            ten_referral_rewarded_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            },
            referral_created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            referral_updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            }
        },
        {timestamps: false, freezeTableName: true}
    );
};
