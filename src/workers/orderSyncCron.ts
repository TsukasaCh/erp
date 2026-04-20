import cron from 'node-cron';
import { env } from '../config/env';
import { syncShopeeOrders, syncTiktokOrders } from '../services/sync';

console.log(`[worker] Starting order sync cron with schedule: ${env.syncCron}`);

cron.schedule(env.syncCron, async () => {
  const started = Date.now();
  console.log('[worker] Tick — pulling orders from both platforms');
  await Promise.allSettled([syncShopeeOrders(), syncTiktokOrders()]);
  console.log(`[worker] Done in ${Date.now() - started}ms`);
});

// Run once on boot so we don't wait for the first tick
(async () => {
  try {
    await Promise.allSettled([syncShopeeOrders(), syncTiktokOrders()]);
    console.log('[worker] Initial sync completed');
  } catch (e) {
    console.error('[worker] Initial sync failed', e);
  }
})();
