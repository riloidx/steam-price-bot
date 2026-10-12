function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable ${name} (see .env.example)`);
  return value;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  dbPath: process.env.DB_PATH || './data/bot.sqlite',
  urls: {
    steamSearch: 'https://store.steampowered.com/api/storesearch/',
    steamAppDetails: 'https://store.steampowered.com/api/appdetails',
    steamApp: 'https://store.steampowered.com/app/',
    // fawazahmed0/exchange-api: primary CDN + official fallback; append `<code>.json`.
    rates: [
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/',
      'https://latest.currency-api.pages.dev/v1/currencies/',
    ],
  },
} as const;
