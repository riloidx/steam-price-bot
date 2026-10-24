import { config } from '../config/index.ts';
import { SEARCH_LIMIT, STEAM_LANGUAGE } from '../constants/index.ts';
import { editionName, getJson } from '../utils/index.ts';

export interface SearchItem {
  id: number;
  name: string;
  image: string;
  // Amounts in currency units; null for free games or when Steam omits the price.
  price: { currency: string; amount: number; initial: number } | null;
}

interface StoreSearchItem {
  id: number;
  name: string;
  tiny_image: string;
  price?: { currency: string; initial: number; final: number };
}

export interface GameDetails {
  id: number;
  name: string;
  developers: string;
  image: string;
  link: string;
  isFree: boolean;
  releaseDate: string | null; // set only for unreleased games
  // All purchasable editions; amounts are in price.currency.
  editions: { name: string; amount: number }[];
  price: { currency: string; amount: number; formatted: string; discount: number } | null;
}

interface AppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      is_free: boolean;
      developers?: string[];
      header_image: string;
      release_date?: { coming_soon: boolean; date: string };
      package_groups?: {
        is_recurring_subscription: string;
        subs: { option_text: string; price_in_cents_with_discount: number }[];
      }[];
      price_overview?: {
        currency: string;
        final: number;
        final_formatted: string;
        discount_percent: number;
      };
    };
  };
}

export async function searchGames(term: string, region: string): Promise<SearchItem[]> {
  const params = new URLSearchParams({ term, cc: region, l: STEAM_LANGUAGE });
  const res = await getJson<{ items?: StoreSearchItem[] }>(`${config.urls.steamSearch}?${params}`);
  return (res.items ?? []).slice(0, SEARCH_LIMIT).map(({ id, name, tiny_image, price }) => ({
    id,
    name,
    image: tiny_image,
    price: price ? { currency: price.currency, amount: price.final / 100, initial: price.initial / 100 } : null,
  }));
}

// Returns null when the app is not sold in this region.
export async function getGameDetails(appId: number, region: string): Promise<GameDetails | null> {
  const params = new URLSearchParams({ appids: String(appId), cc: region, l: STEAM_LANGUAGE });
  const res = await getJson<AppDetailsResponse>(`${config.urls.steamAppDetails}?${params}`);
  const data = res[appId]?.data;
  if (!res[appId]?.success || !data) return null;

  const po = data.price_overview;
  const comingSoon = data.release_date?.coming_soon ?? false;
  if (!data.is_free && !po && !comingSoon) return null;

  return {
    id: appId,
    name: data.name,
    developers: data.developers?.join(', ') || 'Неизвестно',
    image: data.header_image,
    link: `${config.urls.steamApp}${appId}/`,
    isFree: data.is_free,
    releaseDate: comingSoon ? data.release_date!.date : null,
    editions: (data.package_groups ?? [])
      .filter((g) => g.is_recurring_subscription !== 'true')
      .flatMap((g) => g.subs)
      .map((sub) => ({ name: editionName(sub.option_text), amount: sub.price_in_cents_with_discount / 100 })),
    price: po
      ? { currency: po.currency, amount: po.final / 100, formatted: po.final_formatted, discount: po.discount_percent }
      : null,
  };
}
