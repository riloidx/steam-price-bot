import { Bot, type Context, InlineKeyboard, InlineQueryResultBuilder } from 'grammy';
import { config } from '../config/index.ts';
import {
  CB,
  EDITIONS_LIMIT,
  INLINE_CACHE_SECONDS,
  FEE_PRESETS,
  HOME_CURRENCIES,
  KEYBOARD_COLUMNS,
  MAX_FEE_PERCENT,
  REGIONS,
  type RegionCode,
  TEXTS,
} from '../constants/index.ts';
import {
  addWatch,
  getUser,
  isWatching,
  listWatches,
  removeWatch,
  setUserField,
  type User,
} from '../db/index.ts';
import { getRate } from '../rates/index.ts';
import { type GameDetails, getGameDetails, searchGames } from '../steam/index.ts';
import { convert, formatMoney, parseAmount, switchLayout } from '../utils/index.ts';

type ReadyUser = User & { region: RegionCode; currency: string };
// What price lines need from a user; also satisfied by watch rows.
export type PriceSettings = Pick<ReadyUser, 'currency' | 'fee_percent'>;

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
export const watchKeyboard = (appId: number, watching: boolean) =>
  new InlineKeyboard().text(watching ? TEXTS.unwatch : TEXTS.watch, (watching ? CB.unwatch : CB.watch) + appId);

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

async function priceLines(amount: number, currency: string, user: PriceSettings): Promise<string[]> {
  const rate = await getRate(currency, user.currency);
  const { converted, toPay } = convert(amount, rate, user.fee_percent);
  return [
    `≈ ${formatMoney(converted, user.currency)} по курсу`,
    `💳 К оплате с комиссией ${user.fee_percent}%: ${formatMoney(toPay, user.currency)}`,
  ];
}

export async function gameCardText(game: GameDetails, user: PriceSettings): Promise<string> {
  const lines = [`🎮 ${game.name}`, `Разработчик: ${game.developers}`];
  if (game.price) {
    const { currency, amount, formatted, discount } = game.price;
    lines.push(`Цена в Steam: ${formatted}${discount ? ` (−${discount}%)` : ''}`, ...(await priceLines(amount, currency, user)));
    if (game.editions.length > 1) {
      const rate = await getRate(currency, user.currency);
      lines.push('', `Издания (к оплате с комиссией ${user.fee_percent}%):`);
      for (const e of game.editions.slice(0, EDITIONS_LIMIT)) {
        const pay = convert(e.amount, rate, user.fee_percent).toPay;
        lines.push(`• ${e.name} — ${formatMoney(e.amount, currency)} → ${formatMoney(pay, user.currency)}`);
      }
    }
  } else if (game.releaseDate) {
    lines.push(`${TEXTS.comingSoon} ${game.releaseDate}`);
  } else {
    lines.push('Цена: бесплатно');
  }
  lines.push('', game.link);
  return lines.join('\n');
}

async function sendGameCard(ctx: Context, user: ReadyUser, appId: number) {
  const game = await getGameDetails(appId, user.region);
  if (!game) {
    await ctx.reply(TEXTS.unavailable);
    return;
  }
  // Only priced games can go on sale.
  const reply_markup = game.price ? watchKeyboard(appId, isWatching(user.telegram_id, appId)) : undefined;
  await ctx.replyWithPhoto(game.image, { caption: await gameCardText(game, user), reply_markup });
}

function watchlistMessage(telegramId: number) {
  const watches = listWatches(telegramId);
  if (!watches.length) return { text: TEXTS.watchlistEmpty, reply_markup: undefined };
  const kb = new InlineKeyboard();
  for (const w of watches) kb.text(`🔕 ${w.name}`, CB.unwatch + w.app_id).row();
  return { text: TEXTS.watchlist, reply_markup: kb };
}

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Private chats and inline queries only: in groups every message would trigger onboarding.
  // Handlers also rely on ctx.from.
  bot.use((ctx, next) => (ctx.from && (ctx.inlineQuery || ctx.chat?.type === 'private') ? next() : undefined));

  bot.command('start', async (ctx) => {
    await ctx.reply(TEXTS.greet);
    if (await ensureSetup(ctx, getUser(ctx.from!.id))) await ctx.reply(TEXTS.ready);
  });

  bot.command('settings', (ctx) => ctx.reply(settingsText(getUser(ctx.from!.id))));
  bot.command('region', (ctx) => ctx.reply(TEXTS.chooseRegion, { reply_markup: regionKeyboard() }));
  bot.command('currency', (ctx) => ctx.reply(TEXTS.chooseCurrency, { reply_markup: currencyKeyboard() }));

  bot.command('watchlist', (ctx) => {
    const { text, reply_markup } = watchlistMessage(ctx.from!.id);
    return ctx.reply(text, { reply_markup });
  });

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

  bot.callbackQuery(new RegExp(`^${CB.watch}(\\d+)$`), async (ctx) => {
    const user = getUser(ctx.from.id);
    if (!(await ensureSetup(ctx, user))) return ctx.answerCallbackQuery();
    const appId = Number(ctx.match[1]);
    const game = await getGameDetails(appId, user.region!);
    if (!game?.price) return ctx.answerCallbackQuery(TEXTS.unavailable);
    addWatch(user.telegram_id, appId, game.name, game.price.discount);
    await ctx.answerCallbackQuery(TEXTS.watchOn);
    await ctx.editMessageReplyMarkup({ reply_markup: watchKeyboard(appId, true) });
  });

  bot.callbackQuery(new RegExp(`^${CB.unwatch}(\\d+)$`), async (ctx) => {
    const appId = Number(ctx.match[1]);
    removeWatch(ctx.from.id, appId);
    await ctx.answerCallbackQuery(TEXTS.watchOff);
    // Game cards and discount alerts are photos; otherwise it's the /watchlist message.
    if (ctx.callbackQuery.message?.photo) {
      await ctx.editMessageReplyMarkup({ reply_markup: watchKeyboard(appId, false) });
    } else {
      const { text, reply_markup } = watchlistMessage(ctx.from.id);
      await ctx.editMessageText(text, { reply_markup });
    }
  });

  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const user = getUser(ctx.from.id);
    if (!isReady(user)) {
      return ctx.answerInlineQuery([], {
        button: { text: TEXTS.inlineSetup, start_parameter: 'setup' },
        cache_time: 0,
        is_personal: true,
      });
    }
    if (!query) return ctx.answerInlineQuery([], { cache_time: 0 });

    // Search results already carry prices, so no appdetails call per keystroke.
    let games = await searchGames(query, user.region);
    if (!games.length) games = await searchGames(switchLayout(query), user.region);

    const results = await Promise.all(
      games.map(async (g) => {
        const lines = [`🎮 ${g.name}`];
        let description: string = TEXTS.inlineNoPrice;
        if (g.price) {
          const { currency, amount, initial } = g.price;
          const discount = initial > amount ? Math.round((1 - amount / initial) * 100) : 0;
          const pay = await priceLines(amount, currency, user);
          lines.push(`Цена в Steam: ${formatMoney(amount, currency)}${discount ? ` (−${discount}%)` : ''}`, ...pay);
          description = pay[1]!;
        } else {
          lines.push(TEXTS.inlineNoPrice);
        }
        lines.push('', `${config.urls.steamApp}${g.id}/`);
        return InlineQueryResultBuilder.article(String(g.id), g.name, { description, thumbnail_url: g.image })
          .text(lines.join('\n'));
      }),
    );
    await ctx.answerInlineQuery(results, { cache_time: INLINE_CACHE_SECONDS, is_personal: true });
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

