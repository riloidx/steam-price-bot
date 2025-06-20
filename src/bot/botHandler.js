const {helper} = require('../utils');
const {steamService} = require('../services');
const {InlineKeyboard} = require('grammy');
const User = require('../models/user');
const {regions, telegram} = require("../config");

function setupBotHandlers(bot) {
    bot.command('start', async (ctx) => {

        const greet = 'Привет! Я помогу узнать цены игр в Steam в BYN';
        const regionMsg = 'Для начала работы выберите предпочитаемый регион';
        const gameToSearchMsg = 'Введите название игры';

        const [userInstance, created] = await User.findOrCreate({
            where: {telegram_id: ctx.from.id},
            defaults: {telegram_id: ctx.from.id}
        });

        await ctx.reply(greet);

        if (userInstance.region === undefined) {
            await ctx.reply(regionMsg, {reply_markup: helper.getRegionKeyboard()});
        } else {
            await ctx.reply(gameToSearchMsg);
        }
    });

    bot.command('region', async (ctx) => {
        const msg = 'Выберите свой регион:';
        await ctx.reply(msg, {reply_markup: helper.getRegionKeyboard()});
    });

    bot.callbackQuery(/set_region_(.+)/, async (ctx) => {
        const regionCode = ctx.match[1];
        if (!regions[regionCode]) {
            await ctx.answerCallbackQuery('❌ Неверный регион');
            return;
        }

        await User.update(
            {region: regionCode},
            {where: {telegram_id: ctx.from.id}}
        );

        await ctx.answerCallbackQuery(`✅ Регион: ${regions[regionCode]}`);
        await ctx.editMessageText(`Ваш регион: ${regions[regionCode]}\nВведите название игры:`);
    });

    bot.on('message', async (ctx) => {
        try {
            const userInstance = await User.findOne({
                where: {
                    telegram_id: ctx.from.id
                }
            });

            const data = await steamService.getGameInfo(ctx.message.text, userInstance.region);
            await ctx.replyWithPhoto(data.image, {caption: helper.formatSendingText(data)});

        } catch (error) {
            if (error.message.includes('is_free')) {
                await ctx.reply('Похоже эта игра недоступна в вашем регионе');
            }
            else {
                console.error('Error processing game info:', error);
                await ctx.reply('Произошла ошибка, повторите попытку');
            }
        }
    });
}

module.exports = {
    setupBotHandlers
};