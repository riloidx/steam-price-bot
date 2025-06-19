const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

module.exports = {
    telegram: {
        token: process.env.TG_BOT_API_KEY
    },
    google: {
        apiKey: process.env.GOOGLE_API_KEY,
        cx: process.env.CX
    },
    mysql: {
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        host: process.env.MYSQL_HOST,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT,
    },
    regions: {
        kz: '🇰🇿 Казахстан',
        us: '🇺🇸 США',
        ru: '🇷🇺 Россия',
        tr: '🇹🇷 Турция',
        ua: '🇺🇦 Украина',
        ar: '🇦🇷 Аргентина'
    }
};