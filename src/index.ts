import { createBot } from './bot/index.ts';
import { COMMANDS } from './constants/index.ts';
import { closeDb } from './db/index.ts';

const bot = createBot();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await bot.stop();
    closeDb();
  });
}

await bot.api.setMyCommands(COMMANDS);
await bot.start({ onStart: (me) => console.log(`@${me.username} started`) });
