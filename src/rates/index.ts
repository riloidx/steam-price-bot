import { config } from '../config/index.ts';
import { RATES_CACHE_TTL_MS } from '../constants/index.ts';
import { getJson } from '../utils/index.ts';

// base currency → { rates: { target: rate }, fetchedAt }
const cache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();

async function fetchRates(base: string): Promise<Record<string, number>> {
  let lastError: unknown;
  for (const url of config.urls.rates) {
    try {
      const res = await getJson<Record<string, unknown>>(`${url}${base}.json`);
      return res[base] as Record<string, number>;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// Market rate: 1 unit of `from` = N units of `to`.
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const base = from.toLowerCase();
  let entry = cache.get(base);
  if (!entry || Date.now() - entry.fetchedAt > RATES_CACHE_TTL_MS) {
    entry = { rates: await fetchRates(base), fetchedAt: Date.now() };
    cache.set(base, entry);
  }
  const rate = entry.rates[to.toLowerCase()];
  if (!rate) throw new Error(`No rate ${from}→${to}`);
  return rate;
}
