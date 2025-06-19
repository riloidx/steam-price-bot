const axios = require('axios');
const {helper} = require('../utils');
const {convertPricesToByn} = require('./currencyService');
const config = require('../config');

async function findGameId(gameName) {
    const response = await axios.get(
        `https://www.googleapis.com/customsearch/v1?key=${config.google.apiKey}&cx=${config.google.cx}&q=${encodeURIComponent(`${gameName} steam`)}`
    );

    if (!response.data.items) throw new Error("No results found");
    return helper.getGameIdFromUrl(response.data.items[0].link);
}

async function fetchGameData(gameId, region) {
    const response = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=${region}`
    );
    return response.data[String(gameId)].data;
}

async function getGamePrice(gameId, region) {
    const regionalData = await fetchGameData(gameId, region);

    if (regionalData.is_free) {
        return {
            currency: 'USD',
            final: 0,
            final_formatted: 'Бесплатно',
            discount: 0
        };
    }

    const price = regionalData.price_overview;
    return {
        currency: price.currency,
        final: price.final / 100,
        final_formatted: price.final_formatted,
        discount: price.discount_percent
    };
}

async function getGameInfo(gameName, region) {
    const game = await findGameId(gameName);
    const baseData = await fetchGameData(game.id);

    const prices = baseData.is_free
        ? [{
            currency: 'USD',
            final: 0,
            final_formatted: 'Бесплатно',
            discount: 0
        }]
        : await getGamePrice(game.id, region);

    const convertedPrices = await convertPricesToByn(prices);

    return {
        id: baseData.steam_appid,
        name: baseData.name,
        developers: baseData.developers?.join(', ') || 'Неизвестно',
        prices: convertedPrices,
        link: `https://store.steampowered.com/app/${game.id}/`,
        image: baseData.header_image
    };
}

module.exports = {
    getGameInfo
};