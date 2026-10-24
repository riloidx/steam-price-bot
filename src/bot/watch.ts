import { setTimeout as sleep } from 'node:timers/promises';
import { type Api, GrammyError } from 'grammy';
import { TEXTS, WATCH_REQUEST_DELAY_MS } from '../constants/index.ts';
import { allWatches, removeAllWatches, setWatchDiscount, type WatchWithUser } from '../db/index.ts';
import { type GameDetails, getGameDetails } from '../steam/index.ts';
import { gameCardText, watchKeyboard } from './index.ts';

// Checks every watched game once per region and alerts users when its discount grows.
export async function checkWatches(api: Api): Promise<void> {
  const groups = new Map<string, WatchWithUser[]>();
  for (const w of allWatches()) {
    const key = `${w.app_id}:${w.region}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  for (const watches of groups.values()) {
    const { app_id, region } = watches[0]!;
    try {
      const game = await getGameDetails(app_id, region);
      const discount = game?.price?.discount ?? 0;
      for (const w of watches) {
        if (discount === w.last_discount) continue;
        setWatchDiscount(w.telegram_id, app_id, discount);
        if (game && discount > w.last_discount) await notify(api, w, game);
      }
    } catch (error) {
      console.error(`Watch check for app ${app_id} (${region}) failed:`, error);
    }
    await sleep(WATCH_REQUEST_DELAY_MS);
  }
}

async function notify(api: Api, w: WatchWithUser, game: GameDetails) {
  try {
    const caption = `${TEXTS.discountAlert}\n${await gameCardText(game, w)}`;
    await api.sendPhoto(w.telegram_id, game.image, { caption, reply_markup: watchKeyboard(w.app_id, true) });
  } catch (error) {
    // 403: the user blocked the bot, stop polling for them.
    if (error instanceof GrammyError && error.error_code === 403) removeAllWatches(w.telegram_id);
    else throw error;
  }
}
