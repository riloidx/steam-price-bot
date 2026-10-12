import { Bot, type Context, InlineKeyboard } from 'grammy';
import { config } from '../config/index.ts';
import {
  CB,
  FEE_PRESETS,
  HOME_CURRENCIES,
  KEYBOARD_COLUMNS,
  MAX_FEE_PERCENT,
  REGIONS,
  type RegionCode,
  TEXTS,
} from '../constants/index.ts';
import { getUser, setUserField, type User } from '../db/index.ts';
import { getRate } from '../rates/index.ts';
import { getGameDetails, searchGames } from '../steam/index.ts';
import { convert, formatMoney, parseAmount, switchLayout } from '../utils/index.ts';

type ReadyUser = User & { region: RegionCode; currency: string };

function grid(buttons: [label: string, data: string][]): InlineKeyboard {
  const kb = new InlineKeyboard();
  buttons.forEach(([label, data], i) => {
    if (i > 0 && i % KEYBOARD_COLUMNS === 0) kb.row();
    kb.text(label, data);
  });
  return kb;
}

const regionKeyboard = () =>
  grid(Object.entries(REGIONS).map(([code, r]) => [r.name, CB.region + code]));
const currencyKeyboard = () => grid(HOME_CURRENCIES.map((c) => [c, CB.currency + c]));
const feeKeyboard = () => grid(FEE_PRESETS.map((f) => [`${f}%`, CB.fee + f]));

function isReady(user: User): user is ReadyUser {
  return Boolean(user.region && user.currency && user.fee_set);
}

// Asks for the first missing setting; returns true when the user is fully set up.
async function ensureSetup(ctx: Context, user: User): Promise<boolean> {
  if (!user.region) await ctx.reply(TEXTS.chooseRegion, { reply_markup: regionKeyboard() });
  else if (!user.currency) await ctx.reply(TEXTS.chooseCurrency, { reply_markup: currencyKeyboard() });
  else if (!user.fee_set) await ctx.reply(TEXTS.chooseFee, { reply_markup: feeKeyboard() });
  return isReady(user);
}

// Saves a setting and moves onboarding forward (or just confirms for an already set-up user).
async function saveSetting(ctx: Context, apply: () => void, confirmation: string) {
  const id = ctx.from!.id;
  const wasReady = isReady(getUser(id));
  apply();
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`✅ ${confirmation}`);
  } else {
    await ctx.reply(`✅ ${confirmation}`);
  }
  if ((await ensureSetup(ctx, getUser(id))) && !wasReady) await ctx.reply(TEXTS.ready);
}

function settingsText(user: User): string {
  const region = user.region ? REGIONS[user.region].name : '—';
  return [
    `Регион Steam: ${region} — /region`,
    `Валюта пополнения: ${user.currency ?? '—'} — /currency`,
    `Комиссия: ${user.fee_percent}% — /fee`,
  ].join('\n');
}

async function sendConversion(ctx: Context, user: ReadyUser, amount: number) {
  const steamCurrency = REGIONS[user.region].currency;
  const rate = await getRate(steamCurrency, user.currency);
  const { converted, toPay } = convert(amount, rate, user.fee_percent);
  await ctx.reply(
    [
      `${formatMoney(amount, steamCurrency)} в Steam ≈ ${formatMoney(converted, user.currency)}`,
      `💳 К оплате с комиссией ${user.fee_percent}%: ${formatMoney(toPay, user.currency)}`,
      `Курс: 1 ${steamCurrency} = ${rate.toFixed(4)} ${user.currency}`,
    ].join('\n'),
  );
}

async function sendGameCard(ctx: Context, user: ReadyUser, appId: number) {
  const game = await getGameDetails(appId, user.region);
  if (!game) {
    await ctx.reply(TEXTS.unavailable);
    return;
  }

  const lines = [`🎮 ${game.name}`, `Разработчик: ${game.developers}`];
  if (game.price) {
    const { currency, amount, formatted, discount } = game.price;
    const rate = await getRate(currency, user.currency);
    const { converted, toPay } = convert(amount, rate, user.fee_percent);
    lines.push(
      `Цена в Steam: ${formatted}${discount ? ` (−${discount}%)` : ''}`,
      `≈ ${formatMoney(converted, user.currency)} по курсу`,
      `💳 К оплате с комиссией ${user.fee_percent}%: ${formatMoney(toPay, user.currency)}`,
    );
  } else {
    lines.push('Цена: бесплатно');
  }
  lines.push('', game.link);

  await ctx.replyWithPhoto(game.image, { caption: lines.join('\n') });
}

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Every handler below relies on ctx.from (channel posts etc. have none).
  bot.use((ctx, next) => (ctx.from ? next() : undefined));

  bot.command('start', async (ctx) => {
    await ctx.reply(TEXTS.greet);
    if (await ensureSetup(ctx, getUser(ctx.from!.id))) await ctx.reply(TEXTS.ready);
  });

  bot.command('settings', (ctx) => ctx.reply(settingsText(getUser(ctx.from!.id))));
  bot.command('region', (ctx) => ctx.reply(TEXTS.chooseRegion, { reply_markup: regionKeyboard() }));
  bot.command('currency', (ctx) => ctx.reply(TEXTS.chooseCurrency, { reply_markup: currencyKeyboard() }));

  bot.command('fee', async (ctx) => {
    if (!ctx.match) {
      await ctx.reply(TEXTS.chooseFee, { reply_markup: feeKeyboard() });
      return;
    }
    const fee = parseAmount(ctx.match);
    if (fee === null || fee > MAX_FEE_PERCENT) {
      await ctx.reply(TEXTS.feeUsage);
      return;
    }
    await saveSetting(ctx, () => setUserField(ctx.from!.id, 'fee_percent', fee), `Комиссия: ${fee}%`);
  });

  bot.callbackQuery(new RegExp(`^${CB.region}(.+)$`), async (ctx) => {
    const code = ctx.match[1] as RegionCode;
    if (!(code in REGIONS)) return ctx.answerCallbackQuery(TEXTS.invalid);
    await saveSetting(ctx, () => setUserField(ctx.from.id, 'region', code), `Регион: ${REGIONS[code].name}`);
  });

  bot.callbackQuery(new RegExp(`^${CB.currency}(.+)$`), async (ctx) => {
    const currency = ctx.match[1]!;
    if (!(HOME_CURRENCIES as readonly string[]).includes(currency)) return ctx.answerCallbackQuery(TEXTS.invalid);
    await saveSetting(ctx, () => setUserField(ctx.from.id, 'currency', currency), `Валюта: ${currency}`);
  });

  bot.callbackQuery(new RegExp(`^${CB.fee}(.+)$`), async (ctx) => {
    const fee = parseAmount(ctx.match[1]!);
    if (fee === null || fee > MAX_FEE_PERCENT) return ctx.answerCallbackQuery(TEXTS.invalid);
    await saveSetting(ctx, () => setUserField(ctx.from.id, 'fee_percent', fee), `Комиссия: ${fee}%`);
  });

  bot.callbackQuery(new RegExp(`^${CB.game}(\\d+)$`), async (ctx) => {
    await ctx.answerCallbackQuery();
    const user = getUser(ctx.from.id);
    if (await ensureSetup(ctx, user)) await sendGameCard(ctx, user as ReadyUser, Number(ctx.match[1]));
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // unknown command
    const user = getUser(ctx.from.id);
    if (!(await ensureSetup(ctx, user))) return;
    const ready = user as ReadyUser;

    const amount = parseAmount(text);
    if (amount !== null) return sendConversion(ctx, ready, amount);

    let games = await searchGames(text, ready.region);
    if (!games.length) games = await searchGames(switchLayout(text), ready.region);

    if (!games.length) await ctx.reply(TEXTS.notFound);
    else if (games.length === 1) await sendGameCard(ctx, ready, games[0]!.id);
    else {
      const kb = new InlineKeyboard();
      for (const g of games) kb.text(g.name, CB.game + g.id).row();
      await ctx.reply(TEXTS.pickGame, { reply_markup: kb });
    }
  });

  bot.catch(async ({ ctx, error }) => {
    console.error(`Update ${ctx.update.update_id} failed:`, error);
    await ctx.reply(TEXTS.error).catch(() => {});
  });

  return bot;
}

