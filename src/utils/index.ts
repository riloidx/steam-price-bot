// Pure helpers, no config/env imports so they stay testable.
import { CURRENCY_SYMBOLS, FETCH_TIMEOUT_MS, LAYOUT_EN, LAYOUT_RU } from '../constants/index.ts';

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export function convert(amount: number, rate: number, feePercent: number) {
  const converted = amount * rate;
  return { converted, toPay: converted * (1 + feePercent / 100) };
}

export function formatMoney(amount: number, currency: string): string {
  const value = amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return `${value} ${CURRENCY_SYMBOLS[currency] ?? currency}`;
}

// Retypes text as if the keyboard layout was switched (RU→EN if it has cyrillic, else EN→RU).
export function switchLayout(text: string): string {
  const toEn = /[а-яё]/i.test(text);
  const [from, to] = toEn ? [LAYOUT_RU, LAYOUT_EN] : [LAYOUT_EN, LAYOUT_RU];
  return [...text.toLowerCase()].map((ch) => to[from.indexOf(ch)] ?? ch).join('');
}

// "5000", "5 000", "12,5" → number; anything else → null.
export function parseAmount(text: string): number | null {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
