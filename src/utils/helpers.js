const {InlineKeyboard} = require("grammy");
const config = require("../config");

function getGameIdFromUrl(url) {
    const params = url.split('/');
    return { id: params[4] };
}

function formatPrices(price) {
    return `\n${price.final_formatted} \u2248 ${price.converted.formatted}`;
}

function formatSendingText(data) {
    const pricesText = formatPrices(data.prices);
    return `Название: ${data.name}\nРазработчик: ${data.developers}\nЦены: ${pricesText}\nСкидка: ${data.prices.discount}%\n\nСсылка на игру: ${data.link}`;
}

function getRegionKeyboard() {
    const regionKeyboard = new InlineKeyboard();
    Object.entries(config.regions).forEach(([code, name], index) => {
        if (index % 2 === 0) {
            regionKeyboard.row().text(name, `set_region_${code}`);
        } else {
            regionKeyboard.text(name, `set_region_${code}`);
        }
    });
    return regionKeyboard;
}

module.exports = {
    getGameIdFromUrl,
    formatSendingText,
    getRegionKeyboard
};