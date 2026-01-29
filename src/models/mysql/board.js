module.exports = (Sequelize, DataTypes) => {
    return Sequelize.define(
        'boards',
        {
            board_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            board_title: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            board_description: {
                type: DataTypes.STRING(2000),
                allowNull: false,
            },
            board_image_url: {
                type: DataTypes.STRING(200),
                allowNull: true,
                defaultValue: null
            },
            board_link: {
                type: DataTypes.STRING(200),
                allowNull: true,
                defaultValue: null
            },
            board_hot: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            board_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1000000
            },
            board_status: {
                type: DataTypes.TINYINT,
                allowNull: false,
                defaultValue: 1,
            },
            board_created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            board_updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            }
        },
        { timestamps: false, freezeTableName: true }
    );
};
