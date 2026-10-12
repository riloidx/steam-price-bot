// Steam regions: store country code → label and the currency Steam charges there.
// TR moved to USD in 2023; BY is priced in USD too.
export const REGIONS = {
  kz: { name: '🇰🇿 Казахстан', currency: 'KZT' },
  ru: { name: '🇷🇺 Россия', currency: 'RUB' },
  ua: { name: '🇺🇦 Украина', currency: 'UAH' },
  us: { name: '🇺🇸 США', currency: 'USD' },
  tr: { name: '🇹🇷 Турция', currency: 'USD' },
  by: { name: '🇧🇾 Беларусь', currency: 'USD' },
} as const;
export type RegionCode = keyof typeof REGIONS;

// Currencies a user can pay with, code → symbol.
export const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  BYN: 'Br',
  KZT: '₸',
  UAH: '₴',
  USD: '$',
  EUR: '€',
};
export const HOME_CURRENCIES = ['RUB', 'BYN', 'KZT', 'UAH', 'USD', 'EUR'] as const;

export const FEE_PRESETS = [0, 3, 5, 10, 15] as const;
export const MAX_FEE_PERCENT = 99;

export const SEARCH_LIMIT = 5;
export const STEAM_LANGUAGE = 'russian';
export const FETCH_TIMEOUT_MS = 10_000;
export const RATES_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const KEYBOARD_COLUMNS = 2;

// Callback-data prefixes, payload follows the prefix.
export const CB = {
  region: 'region:',
  currency: 'currency:',
  fee: 'fee:',
  game: 'game:',
} as const;

// Same physical keys on QWERTY and ЙЦУКЕН, for fixing "ыефдлук" → "stalker".
export const LAYOUT_EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
export const LAYOUT_RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю';

export const TEXTS = {
  greet: 'Привет! Я покажу цену игры в твоём регионе Steam и сколько нужно закинуть в твоей валюте.',
  chooseRegion: 'Выбери регион своего аккаунта Steam:',
  chooseCurrency: 'В какой валюте ты пополняешь Steam?',
  chooseFee: 'Какая комиссия у твоего способа пополнения? Своё значение: /fee 7.5',
  ready: 'Готово! Пришли название игры или сумму в валюте Steam (например 5000).',
  feeUsage: `Укажи комиссию числом от 0 до ${MAX_FEE_PERCENT}, например: /fee 7.5`,
  notFound: 'Не нашёл. Попробуй официальное название или его начало (например «hollow kn»).',
  pickGame: 'Нашёл несколько вариантов:',
  unavailable: 'Похоже, эта игра недоступна в твоём регионе.',
  error: 'Произошла ошибка, попробуй ещё раз.',
  invalid: '❌ Неверное значение',
} as const;

export const COMMANDS = [
  { command: 'start', description: 'Начать / настроить' },
  { command: 'settings', description: 'Мои настройки' },
  { command: 'region', description: 'Регион Steam' },
  { command: 'currency', description: 'Валюта пополнения' },
  { command: 'fee', description: 'Комиссия пополнения, %' },
];
