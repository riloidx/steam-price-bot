import { config } from '../config/index.ts';
import { SEARCH_LIMIT, STEAM_LANGUAGE } from '../constants/index.ts';
import { getJson } from '../utils/index.ts';

export interface SearchItem {
  id: number;
  name: string;
}

export interface GameDetails {
  id: number;
  name: string;
  developers: string;
  image: string;
  link: string;
  isFree: boolean;
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
  const res = await getJson<{ items?: SearchItem[] }>(`${config.urls.steamSearch}?${params}`);
  return (res.items ?? []).slice(0, SEARCH_LIMIT).map(({ id, name }) => ({ id, name }));
}

// Returns null when the app is not sold in this region.
export async function getGameDetails(appId: number, region: string): Promise<GameDetails | null> {
  const params = new URLSearchParams({ appids: String(appId), cc: region, l: STEAM_LANGUAGE });
  const res = await getJson<AppDetailsResponse>(`${config.urls.steamAppDetails}?${params}`);
  const data = res[appId]?.data;
  if (!res[appId]?.success || !data) return null;

  const po = data.price_overview;
  if (!data.is_free && !po) return null;

  return {
    id: appId,
    name: data.name,
    developers: data.developers?.join(', ') || 'Неизвестно',
    image: data.header_image,
    link: `${config.urls.steamApp}${appId}/`,
    isFree: data.is_free,
    price: po
      ? { currency: po.currency, amount: po.final / 100, formatted: po.final_formatted, discount: po.discount_percent }
      : null,
  };
}
