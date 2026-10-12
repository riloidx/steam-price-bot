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

export function closeDb(): void {
  db.close();
}
