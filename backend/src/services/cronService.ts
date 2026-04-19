// Cron Service - Scheduled Jobs
// Runs insight generation and class reports on a schedule

import cron from 'node-cron';
import { runInsightGeneration, runClassReportGeneration, generateTopicClassSummaries, generateSectionTopicSummaries } from './insightService.js';

/**
 * Initialize all cron jobs
 * Call this from server.ts on startup
 */
export function initCronJobs(): void {
    console.log('[CRON] Initializing cron jobs...');

    // Run every 5 minutes for testing (production would be '0 * * * *' for hourly)
    // Cron format: minute hour day-of-month month day-of-week
    cron.schedule('*/5 * * * *', async () => {
        console.log('\n========================================');
        console.log('[CRON] Starting scheduled insight job...');
        console.log(`[CRON] Time: ${new Date().toISOString()}`);
        console.log('========================================\n');

        try {
            // Phase 2: Generate student insights (individual summaries)
            await runInsightGeneration();

            // Phase 3: Generate class reports (aggregated for professor)
            await runClassReportGeneration();

            // Phase 4: Generate per-topic class summaries for ALL classes
            const classesWithTopics = await (await import('../db/pool.js')).db.query<{ id_class: number }>(
              `SELECT DISTINCT id_class FROM class_topic`
            );
            for (const cls of classesWithTopics.rows) {
              await generateTopicClassSummaries(cls.id_class);
            }

            // Phase 5: Combine class_topic summaries into section_topic
            await generateSectionTopicSummaries();

            console.log('\n========================================');
            console.log('[CRON] Scheduled job complete.');
            console.log('========================================\n');
        } catch (err) {
            console.error('[CRON] Job failed:', err);
        }
    });

    console.log('[CRON] ✅ Scheduled: Insight generation every 5 minutes');
}

