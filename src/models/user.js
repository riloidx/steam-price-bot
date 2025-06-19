const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    telegram_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    region: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'users'
});

(async () => {
    await sequelize.sync();
})();

module.exports = User;
