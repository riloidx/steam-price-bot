const axios = require('axios');
require('dotenv').config();
const {Bot} = require("grammy");

const bot = new Bot(process.env.TG_BOT_API_KEY);

const regions = ['us', 'kz', 'ua', 'cn'];

async function findGameId(gameName) {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const CX = process.env.CX;
    const query = `${gameName} steam`;

    const response = await axios.get(
        `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`
    );

    if (!response.data.items) {
        throw new Error("No results found");
    }
    const data = response.data.items[0];

    return getGameIdFromUrl(data.link);
}

function getGameIdFromUrl(url) {
    const params = url.split('/');
    return { id: params[4] };
}

async function findGameData(gameId, region = 'us') {
    const response = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=${region}`
    );

    return response.data[String(gameId)].data
}

async function getFormatedGameInfo(gameId) {
    const data = await findGameData(gameId);

    const url = `https://store.steampowered.com/app/${gameId}/`;

    let prices = [];
    if (data.is_free) {
        prices.push('Бесплатно');
    }
    else {
        prices = await findPrices(gameId);
    }

    return {
        id: data.steam_appid,
        name: data.name,
        developers: data.developers?.join(', ') || 'Неизвестно',
        prices: prices,
        link: url,
        image: data.header_image
    };
}

async function findPrices(gameId) {
    const prices = [];

    for (const region in regions) {
        const data  = await findGameData(gameId, regions[region]);

        const price = data.price_overview;

        prices.push({
            currency: price.currency,
            final: price.final / 100,
            final_formatted: price.final_formatted,
            discount: price.discount_percent
        });
    }

    return prices;
}

async function main() {
    const gameName = 'cyberpunk';

    const game = await findGameId(gameName);
    const data = await getFormatedGameInfo(game.id);
    console.log(data);
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


