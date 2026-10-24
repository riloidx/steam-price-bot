# steam-price-bot

Telegram-бот для людей, у которых аккаунт Steam другого региона (например KZ), а платят они в своей валюте (например RUB через сервис пополнения). Бот:
- ищет игру в Steam и показывает цену в регионе пользователя;
- переводит её в домашнюю валюту по рыночному курсу и добавляет комиссию пользователя → «сколько закинуть»;
- переводит произвольную сумму: пользователь шлёт `5000` → сумма в валюте Steam → к оплате в своей валюте.

## Стек
- Node ≥ 22.18, TypeScript запускается **нативно** (type stripping) — сборки нет, `tsc` только для проверки типов.
- `node:sqlite` (встроенный, без ORM и нативных модулей), встроенный `fetch`, `.env` через `--env-file-if-exists`.
- Единственная runtime-зависимость — `grammy`. Пакетный менеджер — pnpm.

## Команды
```
pnpm install
pnpm dev         # watch-режим
pnpm start
pnpm typecheck   # tsc --noEmit
pnpm test        # node --test, src/**/*.test.ts
```
Переменные окружения — см. `.env.example` (`BOT_TOKEN` обязателен, `DB_PATH` опционален).

## Структура `src/`
Каждый модуль — свой каталог с `index.ts`; импорт всегда явный (`../steam/index.ts`), Node ESM не резолвит каталоги. Тесты — рядом с модулем (`utils/utils.test.ts`).

- `index.ts` — запуск бота, меню команд, graceful shutdown.
- `config/` — env + **все URL** внешних API.
- `constants/` — регионы, валюты, пресеты комиссии, лимиты/таймауты, callback-префиксы, тексты.
- `db/` — SQLite: таблицы `users` (telegram_id, region, currency, fee_percent, fee_set) и `watches` (telegram_id, app_id, name, last_discount). Схема создаётся при старте (`CREATE TABLE IF NOT EXISTS`); при изменении схемы добавлять `ALTER TABLE` рядом.
- `steam/` — поиск (`storesearch`) и детали игры (`appdetails`).
- `rates/` — курсы с кэшем в памяти и fallback-зеркалом.
- `utils/` — чистые функции (конвертация, формат денег, смена раскладки, парсинг суммы) + `getJson`. Не импортирует `config`, чтобы тесты не требовали env.
- `bot/` — команды (`/start /settings /region /currency /fee /watchlist`), callback'и, онбординг, карточка игры (с изданиями), inline-режим. Только личные чаты.
  - `bot/watch.ts` — раз в 6 ч проверяет отслеживаемые игры (по одному `appdetails` на игру×регион, пауза 1.5 с) и шлёт уведомление, когда скидка выросла.

## Правила
- URL — только в `config/`, константы и тексты — только в `constants/`.
- Импорты с расширением `.ts`; только erasable-синтаксис (никаких `enum`, `namespace`, parameter properties) — иначе Node не запустит файл.
- Новая зависимость — только если встроенное в Node не справляется.

## Предметная логика
- `к оплате = сумма_steam × курс(steam→домашняя) × (1 + fee/100)` (`utils.convert`).
- Внутренний курс Steam публично недоступен и не нужен: пользователь платит сервису пополнения по его курсу, поэтому «рыночный курс + комиссия пользователя» — сознательное приближение.
- Валюта цены берётся из ответа Steam (`price_overview.currency`); `REGIONS[...].currency` нужна только для конвертации суммы. TR и BY в Steam — USD.
- Онбординг: регион → валюта → комиссия. Пока что-то не выбрано, любой ввод возвращает к этому шагу (`ensureSetup`).

## Внешние API (без ключей)
- Поиск: `store.steampowered.com/api/storesearch/?term=&cc=&l=russian` — находит по префиксу и официальному локализованному названию, **опечатки не прощает**. Если 0 результатов, повторяем с исправленной раскладкой (`ыефдлук` → `stalker`).
- Детали: `store.steampowered.com/api/appdetails?appids=&cc=&l=russian`; `success:false` или нет `price_overview` у платной вышедшей игры → недоступна в регионе. `release_date.coming_soon` → ещё не вышла. Издания — `package_groups[].subs[]` (`option_text` = «название - цена», у скидок с HTML).
- Inline-режим берёт цену прямо из `storesearch` (`items[].price`), без `appdetails` на каждое нажатие.
- Курсы: `fawazahmed0/exchange-api` (jsDelivr + `currency-api.pages.dev`), обновляются раз в сутки, кэш 12 ч.
