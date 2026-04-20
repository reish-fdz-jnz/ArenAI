// Cron Service - Scheduled Jobs
// Runs insight generation and class reports on a schedule

import cron from 'node-cron';
import { runFullInsightPipeline, generateTopicClassSummaries, generateSectionTopicSummaries } from './insightService.js';

/**
 * Initialize all cron jobs
 * Call this from server.ts on startup
 */
export function initCronJobs(): void {
  console.log('[CRON] Initializing cron jobs...');

  // Run every 5 minutes: Focus on ACTIVE (running) classes
  cron.schedule('*/2 * * * *', async () => {
    console.log('\n========================================');
    console.log('[CRON] Starting periodic insight pipeline for running classes...');
    console.log(`[CRON] Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    try {
      const { db: dbPool } = await import('../db/pool.js');
      const { runFullInsightPipeline } = await import('./insightService.js');

      // 1. Find all classes that are currently 'running'
      const activeClasses = await dbPool.query<{ id_class: number }>(
        `SELECT id_class FROM class WHERE status = 'running'`
      );

      console.log(`[CRON] Found ${activeClasses.rows.length} active classes to process`);

      // 2. Trigger the full pipeline for each active class
      for (const cls of activeClasses.rows) {
        try {
          await runFullInsightPipeline(cls.id_class);
        } catch (e: any) {
          console.error(`[CRON] Failed for class ${cls.id_class}: ${e?.message}`);
        }
      }

      console.log('\n========================================');
      console.log('[CRON] Periodic insight job complete.');
      console.log('========================================\n');
    } catch (err) {
      console.error('[CRON] Periodic job failed:', err);
    }
  });

  console.log('[CRON] ✅ Scheduled: Active class insights every 2 minutes');
}

