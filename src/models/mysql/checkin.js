module.exports = (Sequelize, DataTypes) => {
    return Sequelize.define(
        'checkins',
        {
            wallet_address: {
                type: DataTypes.STRING(64),//foreign key from members table
                allowNull: false,
                primaryKey: true,
            },
            last_checkin_date: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            checkin_streak: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            checkin_total: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            checkin_created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            }
        },
        { timestamps: false, freezeTableName: true }
    );
};
