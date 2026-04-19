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
            // Phase 4.5: Summarize student questions → class_questions_summary
            for (const cls of classesWithTopics.rows) {
              try {
                const { db: dbPool } = await import('../db/pool.js');
                const questions = await dbPool.query<{ question_text: string; topic_detected: string | null; frustration_level: string }>(
                  `SELECT question_text, topic_detected, frustration_level 
                   FROM chatbot_question_log WHERE id_class = ? ORDER BY created_at DESC LIMIT 20`,
                  [cls.id_class]
                );
                if (questions.rows.length === 0) continue;
                const high = questions.rows.filter(q => q.frustration_level === 'high').length;
                const med = questions.rows.filter(q => q.frustration_level === 'medium').length;
                const avgFrust = high > questions.rows.length * 0.4 ? 'high' : (high + med) > questions.rows.length * 0.3 ? 'medium' : 'low';
                const questionList = questions.rows.map(q => 
                  `[${q.frustration_level}] ${q.topic_detected || '?'}: ${q.question_text.substring(0, 80)}`
                ).join('\n');
                const { generateContentWithGemini } = await import('./geminiService.js');
                const aiResp = await generateContentWithGemini(
                  'Resume en 2 oraciones qué preguntan los estudiantes. Solo JSON: {"questions_summary":"...","top_doubts":["duda1","duda2"]}',
                  questionList
                );
                let topDoubts = '[]';
                try { topDoubts = JSON.stringify(JSON.parse(aiResp)?.top_doubts || []); } catch {}
                await dbPool.query(
                  `INSERT INTO class_questions_summary (id_class, questions_summary, top_doubts, total_questions, avg_frustration) VALUES (?, ?, ?, ?, ?)`,
                  [cls.id_class, aiResp, topDoubts, questions.rows.length, avgFrust]
                );
                console.log(`[Phase 4.5] ✅ Questions summary for class ${cls.id_class}`);
              } catch (e: any) {
                console.error(`[Phase 4.5] ❌ Class ${cls.id_class}: ${e?.message}`);
              }
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

