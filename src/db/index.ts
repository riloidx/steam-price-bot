import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/index.ts';
import type { RegionCode } from '../constants/index.ts';

export interface User {
  telegram_id: number;
  region: RegionCode | null;
  currency: string | null;
  fee_percent: number;
  fee_set: number; // 0/1: user has chosen a fee during onboarding
}

mkdirSync(dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    region      TEXT,
    currency    TEXT,
    fee_percent REAL    NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent < 100),
    fee_set     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS watches (
    telegram_id   INTEGER NOT NULL REFERENCES users (telegram_id),
    app_id        INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    last_discount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (telegram_id, app_id)
  )
`);

const insertStmt = db.prepare('INSERT OR IGNORE INTO users (telegram_id) VALUES (?)');
const selectStmt = db.prepare(
  'SELECT telegram_id, region, currency, fee_percent, fee_set FROM users WHERE telegram_id = ?',
);
const updateStmts = {
  region: db.prepare('UPDATE users SET region = ? WHERE telegram_id = ?'),
  currency: db.prepare('UPDATE users SET currency = ? WHERE telegram_id = ?'),
  fee_percent: db.prepare('UPDATE users SET fee_percent = ?, fee_set = 1 WHERE telegram_id = ?'),
};

export function getUser(telegramId: number): User {
  insertStmt.run(telegramId);
  return selectStmt.get(telegramId) as unknown as User;
}

export function setUserField(
  telegramId: number,
  field: keyof typeof updateStmts,
  value: string | number,
): void {
  updateStmts[field].run(value, telegramId);
}

export interface Watch {
  telegram_id: number;
  app_id: number;
  name: string;
  last_discount: number;
}

// A watch joined with its owner's settings, for the discount checker.
export type WatchWithUser = Watch & { region: RegionCode; currency: string; fee_percent: number };

const watchStmts = {
  add: db.prepare(
    'INSERT OR REPLACE INTO watches (telegram_id, app_id, name, last_discount) VALUES (?, ?, ?, ?)',
  ),
  remove: db.prepare('DELETE FROM watches WHERE telegram_id = ? AND app_id = ?'),
  removeAll: db.prepare('DELETE FROM watches WHERE telegram_id = ?'),
  exists: db.prepare('SELECT 1 FROM watches WHERE telegram_id = ? AND app_id = ?'),
  list: db.prepare('SELECT * FROM watches WHERE telegram_id = ? ORDER BY name'),
  setDiscount: db.prepare('UPDATE watches SET last_discount = ? WHERE telegram_id = ? AND app_id = ?'),
  all: db.prepare(`
    SELECT w.*, u.region, u.currency, u.fee_percent FROM watches w
    JOIN users u USING (telegram_id)
    WHERE u.region IS NOT NULL AND u.currency IS NOT NULL
    ORDER BY w.app_id, u.region
  `),
};

export function addWatch(telegramId: number, appId: number, name: string, discount: number): void {
  watchStmts.add.run(telegramId, appId, name, discount);
}

export function removeWatch(telegramId: number, appId: number): void {
  watchStmts.remove.run(telegramId, appId);
}

export function removeAllWatches(telegramId: number): void {
  watchStmts.removeAll.run(telegramId);
}

export function isWatching(telegramId: number, appId: number): boolean {
  return watchStmts.exists.get(telegramId, appId) !== undefined;
}

export function listWatches(telegramId: number): Watch[] {
  return watchStmts.list.all(telegramId) as unknown as Watch[];
}

export function allWatches(): WatchWithUser[] {
  return watchStmts.all.all() as unknown as WatchWithUser[];
}

export function setWatchDiscount(telegramId: number, appId: number, discount: number): void {
  watchStmts.setDiscount.run(discount, telegramId, appId);
}

export function closeDb(): void {
  db.close();
}
