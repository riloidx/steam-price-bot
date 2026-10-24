import { createBot } from './bot/index.ts';
import { checkWatches } from './bot/watch.ts';
import { COMMANDS, WATCH_CHECK_INTERVAL_MS } from './constants/index.ts';
import { closeDb } from './db/index.ts';

const bot = createBot();
const watchTimer = setInterval(() => checkWatches(bot.api).catch(console.error), WATCH_CHECK_INTERVAL_MS);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    clearInterval(watchTimer);
    await bot.stop();
    closeDb();
  });
}

await bot.api.setMyCommands(COMMANDS);
await bot.start({ onStart: (me) => console.log(`@${me.username} started`) });
