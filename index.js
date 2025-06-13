const env = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const {Bot} = require("grammy");

env.config();

const bot = new Bot(process.env.TG_BOT_API_KEY);


async function findGame(gameName) {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const CX = process.env.CX;
    const query = gameName + ' steam';

    const result = await axios.get(
        `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`
    );

    if (!result.data) {
        throw new Error("No results found");
    }
    const data = result.data.items[0];

    return parseGameUrl(data.link);
}

function parseGameUrl(data) {
    const params = data.split('/');
    return {
        id: params[4],
        name: params[5].split('_').join(' ')
    };
}

async function getGamePrice() {}


async function main() {
    const gameName = 'Hades 2';

    const game = await findGame(gameName);
    console.log(game);
}

main();
// bot.command('start', async (ctx) => {
//     console.log(ctx);
//     await ctx.reply("Привет");
// });
//
// bot.on('message', async (ctx) => {
//     console.log(ctx);
//
// });
//
// bot.start();


