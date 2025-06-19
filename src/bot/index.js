const { Bot } = require("grammy");
const config  = require("../config");
const { setupBotHandlers} = require("./botHandler");

function createBot() {
    const bot = new Bot(config.telegram.token);
    setupBotHandlers(bot);
    return bot;
}

module.exports = createBot;