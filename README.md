# Steam Price Bot

Telegram bot for people whose Steam account is in one region (e.g. Kazakhstan) while they pay in another currency (e.g. RUB via a top-up service).

- Search a game → see its price in your Steam region, converted to your currency, plus the amount to pay including your top-up fee.
- Send a number (e.g. `5000`) → get how much that Steam-currency amount costs in your currency.
- Games with several editions (Deluxe, Ultimate…) list every edition with its price.
- Tap **🔔 Watch for a discount** on a game card → the bot checks every 6 hours and messages you when the discount grows.
- Inline mode: type `@your_bot elden ring` in any chat to share a price card.

The bot UI is in Russian; the example below is translated.

```
🎮 Hollow Knight
Price in Steam: 4 100₸
≈ 770 ₽ at market rate
💳 To pay with 5% fee: 809 ₽
```

## How the price is calculated

```
to_pay = steam_price × market_rate(steam_currency → your_currency) × (1 + fee / 100)
```

Steam's internal exchange rate is not public, and it doesn't matter here: you pay the top-up service at *its* rate. So the bot uses the daily market rate and lets you set your own fee to match your service.

## Requirements

- Node.js ≥ 22.18 (runs TypeScript natively, no build step)
- pnpm

## Setup

```bash
pnpm install
cp .env.example .env   # set BOT_TOKEN from @BotFather
pnpm dev
```

| Variable    | Required | Default              |
|-------------|----------|----------------------|
| `BOT_TOKEN` | yes      | —                    |
| `DB_PATH`   | no       | `./data/bot.sqlite`  |

## Scripts

| Command          | Description                    |
|------------------|--------------------------------|
| `pnpm dev`       | Run in watch mode              |
| `pnpm start`     | Run                            |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm test`      | Run tests (`node --test`)      |

## Bot commands

| Command     | Description                                       |
|-------------|---------------------------------------------------|
| `/start`    | Onboarding: Steam region → your currency → fee    |
| `/settings` | Show current settings                             |
| `/region`   | Change Steam region                               |
| `/currency` | Change the currency you pay with                  |
| `/fee 7.5`  | Set a custom top-up fee in percent                |
| `/watchlist`| Games watched for discounts (tap to remove)       |

Any other text is a game search; a plain number is an amount conversion. The bot only answers in private chats.

Inline mode must be enabled once in @BotFather (`/setinline`).

## Search limitations

The bot uses Steam's own store search. It matches title prefixes and official localized names (`hollow kn`, `ведьмак`), but not typos (`hollow knigt`) or unofficial names. If nothing is found, it retries with the keyboard layout switched (`ыефдлук` → `stalker`).

## Stack

- [grammY](https://grammy.dev) — the only runtime dependency
- `node:sqlite` — built-in SQLite, no ORM
- Built-in `fetch`, `--env-file` and `node:test`

## External APIs (no keys needed)

- Steam Store: `storesearch`, `appdetails`
- Exchange rates: [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) (jsDelivr + Cloudflare mirror)

## Project structure

```
src/
  index.ts       entry point
  bot/           commands, callbacks, onboarding, game card, inline mode
                 watch.ts: periodic discount checker
  config/        env and external URLs
  constants/     regions, currencies, texts, limits
  db/            SQLite users and watches tables
  rates/         exchange rates with cache
  steam/         Steam search and app details
  utils/         pure helpers + tests
```

## License

ISC
