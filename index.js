const axios = require('axios');
require('dotenv').config();
const {Bot} = require("grammy");

const bot = new Bot(process.env.TG_BOT_API_KEY);

const regions = ['us', 'kz', 'ua', 'cn'];
let currencies = {};

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
    return {id: params[4]};
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
    } else {
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
        const data = await findGameData(gameId, regions[region]);

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

async function getBankData() {
    const response = await axios.get(
        `https://developerhub.alfabank.by:8273/partner/1.0.1/public/nationalRates
        `);

    const currencies = {};

    response.data.rates.forEach((rate) => {
        currencies[rate.iso] = {
            rate: rate.rate,
            quantity: rate.quantity
        };
    });
    return currencies;
}

function convertToByn(price, currency) {
    const rateInfo = currencies[currency];

    const pricePerUnit = rateInfo.rate / rateInfo.quantity;
    return price * pricePerUnit;
}

async function convertPricesToByn(prices) {
    currencies = await getBankData();
    prices.forEach((price) => {
        const priceInByn = convertToByn(price.final, price.currency).toFixed(2);
        price.converted = {
            currency: 'BYN',
            final: priceInByn,
            formatted: `${priceInByn} Br`,
        }
    });
}

async function getGameInfo(gameName) {
    const game  = await findGameId(gameName);
    const data = await getFormatedGameInfo(game.id);
    await convertPricesToByn(data.prices);
    return data;
}

bot.command('start', async (ctx) => {
    const chatId = ctx.msg.chat.id;
    const greet = 'Привет, я бот который поможет тебе узнать сколько денег тебе нужно закинуть в BYN, ' +
    'чтобы купить игру в твоей валюте Steam!';
    const msg = 'Для начала работы введи название игры';

    await bot.api.sendMessage(chatId, greet);
    await bot.api.sendMessage(chatId, msg);
});

bot.on('message', async (ctx) => {
    try {
        const data = await getGameInfo(ctx.update.message.text);
        let pricesText = '';
        data.prices.forEach(price => {
            pricesText += `\n${price.final_formatted} \u2248 ${price.converted.formatted}`;
        })

        const text = `Название: ${data.name}\nРазработчик: ${data.developers}\nЦены: ${pricesText}\nСкидка: ${data.prices[0].discount}%\n\nСыллка на игру: ${data.link}`;

        await ctx.replyWithPhoto(data.image, {caption: text});
    } catch (error) {
        console.log(error);
        await ctx.reply('Произошла ошибка, повторите попытку');
    }
});

bot.start();


