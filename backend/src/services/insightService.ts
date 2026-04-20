// Insight Generation Service - REFACTORED for New Schema
// Uses learning_chat_history table for chat storage
// Uses student_class_summary for individual student insights
// Uses professor_class_report for aggregated class reports

import { generateContentWithGemini } from './geminiService.js';
import { 
    TOPIC_MASTERY_PROMPT, 
    STUDENT_INSIGHT_PROMPT, 
    CLASS_REPORT_PROMPT,
    TOPIC_CLASS_SUMMARY_PROMPT,
    SECTION_TOPIC_SUMMARY_PROMPT,
    QUESTIONS_SUMMARY_PROMPT
} from '../config/prompts.js';
import {
    getUsersWithUnanalyzedMessages,
    getUnanalyzedMessagesByUser,
    markMessagesAsAnalyzed,
    getSubjectNameById,
    type ChatMessage
} from '../repositories/chatLogRepository.js';
import {
    saveStudentClassSummary,
    getUnprocessedSummaries,
    markSummariesAsProcessed,
    saveProfessorClassReport
} from '../repositories/insightRepository.js';
import { getTopicById } from '../repositories/topicRepository.js';
import { getHistoricalRecordsForTopic, updatePermanentTopicSummary } from '../repositories/studentRepository.js';
import { getQuestionStatsByTopic, getUnsyncedQuestions, markAsSynced } from '../repositories/chatbotQuestionLogRepository.js';
import { db } from '../db/pool.js';

// Default class ID (until class system is fully implemented)
const DEFAULT_CLASS_ID = 1;

// Helper to broadcast to frontend
function broadcastInsightUpdate(message: string, data?: any) {
    try {
        import('../server.js').then(({ io }) => {
            if (io) {
                io.emit('insight_update', { 
                    timestamp: new Date().toISOString(),
                    message,
                    data 
                });
                console.log(`[Broadcast] 📡 Sent to frontend: ${message}`);
            }
        }).catch(() => {
            // Server not yet initialized, skip broadcast
        });
    } catch (e) {
        // Ignore broadcast errors
    }
}

/**
 * Phase 2: Generate student summaries from unanalyzed chat messages
 */
export async function runStudentInsightGeneration(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        🧠 PHASE 2: STUDENT SUMMARY GENERATION                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    
    try {
        // Get users with unanalyzed messages
        const userIds = await getUsersWithUnanalyzedMessages();
        console.log(`📊 Found ${userIds.length} users with unanalyzed messages`);
        
        if (userIds.length === 0) {
            console.log('⏭️  No unanalyzed messages. Skipping Phase 2.');
            broadcastInsightUpdate('🔍 No unanalyzed messages found', {
                phase: 2,
                status: 'skipped',
                reason: 'No unanalyzed messages'
            });
            return;
        }

        broadcastInsightUpdate(`📊 Phase 2 Starting: Found ${userIds.length} users to analyze`, {
            phase: 2,
            status: 'started',
            usersCount: userIds.length
        });

        // Process each user
        for (const userId of userIds) {
            try {
                await processUserSummary(userId);
            } catch (err) {
                console.error(`❌ Failed to process user ${userId}:`, err);
            }
        }

        console.log('✅ Phase 2 complete - Student summaries generated');
    } catch (err) {
        console.error('💥 Fatal error in summary generation:', err);
        broadcastInsightUpdate('💥 Phase 2 Error: Failed to generate summaries', {
            phase: 2,
            status: 'error',
            error: String(err)
        });
    }
}

/**
 * Process summary for a single user's chat messages
 */
async function processUserSummary(userId: number): Promise<void> {
    // Fetch all unanalyzed messages for this user
    const messages = await getUnanalyzedMessagesByUser(userId);
    
    if (messages.length === 0) return;

    // Group by class (or use default class)
    const classGroups = new Map<number, ChatMessage[]>();
    for (const msg of messages) {
        const classId = msg.id_class ?? DEFAULT_CLASS_ID;
        if (!classGroups.has(classId)) {
            classGroups.set(classId, []);
        }
        classGroups.get(classId)!.push(msg);
    }

    // Process each class group
    for (const [classId, classMessages] of classGroups) {
        // Get subject name from first message
        const subjectId = classMessages[0]?.id_subject;
        const subjectName = subjectId ? await getSubjectNameById(subjectId) : 'General';
        
        console.log('');
        console.log('─'.repeat(60));
        console.log(`👤 User ID: ${userId}`);
        console.log(`🏫 Class ID: ${classId}`);
        console.log(`📚 Subject: ${subjectName || 'General'}`);
        console.log(`💬 Messages to analyze: ${classMessages.length}`);

        // Build transcript
        const transcript = classMessages.map((m: ChatMessage) => 
            `[${m.role === 'user' ? 'STUDENT' : 'TUTOR'}]: ${m.content}`
        ).join('\n\n');

        console.log('');
        console.log('📝 TRANSCRIPT:');
        console.log('─'.repeat(40));
        const previewLength = Math.min(transcript.length, 500);
        console.log(transcript.substring(0, previewLength) + (transcript.length > 500 ? '\n... [truncated]' : ''));
        console.log('─'.repeat(40));

        // Build prompt
        const prompt = STUDENT_INSIGHT_PROMPT
            .replace('{SUBJECT}', subjectName || 'General')
            .replace('{TRANSCRIPT}', transcript);

        console.log('');
        console.log('🤖 Calling Gemini AI for student summary...');

        // Call Gemini
        const aiResponse = await generateContentWithGemini(
            'Analyze this tutoring conversation and return JSON:',
            prompt
        );

        console.log('');
        console.log('🎯 STUDENT SUMMARY RESULT:');
        console.log('─'.repeat(40));
        console.log(aiResponse);
        console.log('─'.repeat(40));

        // Parse response
        const parsed = parseInsightResponse(aiResponse);

        if (parsed) {
            // Save to database with new schema (UPSERT)
            await saveStudentClassSummary({
                userId: userId,
                classId: classId,
                summaryText: parsed.summary || '',
                strengths: parsed.strengths || [],
                weaknesses: parsed.weaknesses || parsed.issues || [],
                studyTips: parsed.tips || parsed.study_tips || []
            });

            // Mark messages as analyzed
            const messageIds = classMessages.map((m: ChatMessage) => m.id_message);
            await markMessagesAsAnalyzed(messageIds);

            console.log('');
            console.log('✅ STUDENT SUMMARY SAVED:');
            console.log(`   📖 Summary: ${(parsed.summary || '').substring(0, 100)}...`);
            console.log(`   💪 Strengths: ${JSON.stringify(parsed.strengths || [])}`);
            console.log(`   ⚠️  Weaknesses: ${JSON.stringify(parsed.weaknesses || parsed.issues || [])}`);
            console.log(`   💡 Study Tips: ${JSON.stringify(parsed.tips || parsed.study_tips || [])}`);
            console.log(`   📝 Messages marked as analyzed: ${messageIds.length}`);

            // Broadcast to frontend
            broadcastInsightUpdate(`🎯 Student Summary Generated for User ${userId}`, {
                phase: 2,
                status: 'summary_saved',
                userId: userId,
                classId: classId,
                subject: subjectName || 'General',
                summary: parsed.summary,
                messagesAnalyzed: messageIds.length
            });
        } else {
            console.log('❌ Failed to parse AI response - summary not saved');
        }
    }
}

/**
 * Parse AI response into insight object
 */
function parseInsightResponse(response: string): {
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    issues?: string[];
    tips?: string[];
    study_tips?: string[];
    sentiment?: string;
    // Fields from TOPIC_CLASS_SUMMARY_PROMPT
    key_issues?: string[];
    correlation_impact?: string;
    recommended_actions?: string[];
    frustration_alert?: string | null;
    [key: string]: any;
} | null {
    try {
        let cleaned = response.trim();
        
        // Remove markdown code blocks if present
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        return JSON.parse(cleaned.trim());
    } catch (err) {
        console.error('Parse error:', err);
        return null;
    }
}

/**
 * Phase 3: Generate professor class reports by aggregating student summaries
 */
export async function runClassReportGeneration(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        📋 PHASE 3: PROFESSOR CLASS REPORT GENERATION             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    try {
        // Get unprocessed student summaries
        const summaries = await getUnprocessedSummaries(DEFAULT_CLASS_ID);
        
        if (summaries.length === 0) {
            console.log('⏭️  No unprocessed summaries. Skipping Phase 3.');
            return;
        }

        console.log(`📊 Found ${summaries.length} student summaries to aggregate`);

        // Aggregate weaknesses across all students
        const allWeaknesses: string[] = [];
        const weaknessCount: { [key: string]: number } = {};
        
        for (const summary of summaries) {
            const weaknesses = typeof summary.weaknesses === 'string' 
                ? JSON.parse(summary.weaknesses) 
                : (summary.weaknesses || []);
            
            for (const weakness of weaknesses) {
                const normalized = weakness.toLowerCase().trim();
                weaknessCount[normalized] = (weaknessCount[normalized] || 0) + 1;
                if (!allWeaknesses.includes(normalized)) {
                    allWeaknesses.push(normalized);
                }
            }
        }

        // Sort by frequency
        const topConfusionTopics = Object.entries(weaknessCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, count]) => ({ topic, count }));

        // Build aggregated summary
        const generalSummary = summaries.length > 0 
            ? `Based on ${summaries.length} student conversations, the class is struggling with: ${topConfusionTopics.map(t => t.topic).join(', ')}.`
            : 'No student data available for this period.';

        const suggestedAction = topConfusionTopics.length > 0
            ? `Consider reviewing: ${topConfusionTopics[0].topic}`
            : 'Continue with current curriculum.';

        // Save professor report
        await saveProfessorClassReport({
            classId: DEFAULT_CLASS_ID,
            generalSummary: generalSummary,
            topConfusionTopics: topConfusionTopics,
            sentimentAverage: 'neutral',
            suggestedAction: suggestedAction
        });

        // Mark summaries as processed
        const summaryIds = summaries.map(s => s.id_summary);
        await markSummariesAsProcessed(summaryIds);

        console.log('');
        console.log('✅ PROFESSOR REPORT SAVED:');
        console.log(`   📊 Students analyzed: ${summaries.length}`);
        console.log(`   ⚠️  Top confusion topics: ${JSON.stringify(topConfusionTopics)}`);
        console.log(`   💡 Suggested action: ${suggestedAction}`);

        broadcastInsightUpdate('📋 Professor Class Report Generated', {
            phase: 3,
            status: 'report_saved',
            studentsAnalyzed: summaries.length,
            topConfusionTopics: topConfusionTopics
        });

    } catch (err) {
        console.error('💥 Fatal error in report generation:', err);
    }
}

/**
 * Generate a permanent historical mastery insight for a specific topic
 */
export async function generateTopicMasteryInsight(userId: number, topicId: number): Promise<string | null> {
    try {
        console.log(`[TopicMastery] 🧠 Generating permanent mastery profile for User:${userId}, Topic:${topicId}`);

        // 1. Fetch Topic Info
        const topic = await getTopicById(topicId);
        if (!topic) return null;

        // 2. Fetch Historical Records
        const records = await getHistoricalRecordsForTopic(userId, topicId);

        // 3. Build context for prompt
        const sessionContext = records.sessions.length > 0 
            ? records.sessions.map(s => `- Class: ${s.class_name}, Score: ${s.score}%, AI Summary: ${s.ai_summary || 'N/A'}`).join('\n')
            : 'No class sessions recorded yet.';

        const quizContext = records.quizzes.length > 0
            ? records.quizzes.map(q => `- Quiz: ${q.quiz_name}, Score: ${q.score}%, Date: ${new Date(q.finished_at).toLocaleDateString()}`).join('\n')
            : 'No quizzes taken yet.';

        // 4. Call Gemini
        const prompt = TOPIC_MASTERY_PROMPT
            .replace('{TOPIC_NAME}', topic.name)
            .replace('{SESSION_HISTORY}', sessionContext)
            .replace('{QUIZ_HISTORY}', quizContext);

        const aiResponse = await generateContentWithGemini(
            `Analyze the student's longitudinal progress on ${topic.name}:`,
            prompt
        );

        // 5. Parse and save
        const parsed = parseInsightResponse(aiResponse);
        if (parsed && parsed.summary) {
            await updatePermanentTopicSummary(userId, topicId, parsed.summary);
            console.log(`[TopicMastery] ✅ Permanent profile updated for ${topic.name}`);
            return parsed.summary;
        }

        return null;
    } catch (err) {
        console.error(`[TopicMastery] ❌ Error generating topic insight:`, err);
        return null;
    }
}

// Aliases for backward compatibility with cron job
export const runInsightGeneration = runStudentInsightGeneration;

// ============================================================
// Phase 4: Generate per-topic class summaries
// Follows the same pattern as Phase 2 & 3:
//   - broadcastInsightUpdate for WebSocket
//   - generateContentWithGemini(prompt, systemInstruction)
//   - parseInsightResponse() to clean JSON
//   - db.query with proper typing
//   - Detailed console logging
// ============================================================
export async function generateTopicClassSummaries(classId: number = DEFAULT_CLASS_ID): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        📚 PHASE 4: TOPIC CLASS SUMMARY GENERATION               ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    
    try {
        // 1. Get all topics for this class (same pattern as Phase 3's getUnprocessedSummaries)
        const topicResult = await db.query<{ 
            id_topic: number; 
            name: string; 
            id_subject: number; 
            score_average: number | null;
        }>(
            `SELECT ct.id_topic, t.name, t.id_subject, ct.score_average
             FROM class_topic ct
             INNER JOIN topic t ON t.id_topic = ct.id_topic
             WHERE ct.id_class = ?`,
            [classId]
        );

        if (topicResult.rows.length === 0) {
            console.log('⏭️  No topics found for this class. Skipping Phase 4.');
            broadcastInsightUpdate('🔍 No topics found for class', {
                phase: 4,
                status: 'skipped',
                reason: 'No topics in class_topic'
            });
            return;
        }

        console.log(`📊 Found ${topicResult.rows.length} topics to analyze`);

        broadcastInsightUpdate(`📚 Phase 4 Starting: Found ${topicResult.rows.length} topics to analyze`, {
            phase: 4,
            status: 'started',
            topicCount: topicResult.rows.length
        });

        // 2. Get question stats from chatbot (wrapped in try/catch since table might not exist)
        let questionStats: Awaited<ReturnType<typeof getQuestionStatsByTopic>> = [];
        try {
            questionStats = await getQuestionStatsByTopic(classId);
            console.log(`📝 Found question stats for ${questionStats.length} topics`);
        } catch (e) {
            console.warn('⚠️  chatbot_question_log table may not exist yet - continuing without question data');
        }

        // 3. Get student class summaries (chat conclusions from Phase 2)
        //    Same query pattern as Phase 3's getUnprocessedSummaries
        const summaryResult = await db.query<{
            summary_text: string;
            weaknesses: string | string[] | null;
            strengths: string | string[] | null;
        }>(
            `SELECT summary_text, weaknesses, strengths
             FROM student_class_summary
             WHERE id_class = ?`,
            [classId]
        );

        // Parse weaknesses the same way Phase 3 does
        const chatConclusions = summaryResult.rows.map((s) => {
            const weaknesses = typeof s.weaknesses === 'string'
                ? JSON.parse(s.weaknesses)
                : (s.weaknesses || []);
            return { summary: s.summary_text, weaknesses: weaknesses as string[] };
        });

        console.log(`📋 Loaded ${chatConclusions.length} student summaries for context`);

        // 4. Get student count
        const studentCountResult = await db.query<{ total: number }>(
            `SELECT COUNT(DISTINCT id_user) as total FROM class_student_topic WHERE id_class = ?`,
            [classId]
        );
        const totalStudents = studentCountResult.rows[0]?.total || 0;

        // 5. For each topic, generate a summary
        let successCount = 0;

        // Fetch Class Metadata for Prompt Context
        const classMetaResult = await db.query<{ subject: string, level: string, topics: string }>(
            `SELECT 
                s.name_subject as subject,
                sec.grade as level,
                GROUP_CONCAT(DISTINCT t.name separator ', ') as topics
             FROM class c
             LEFT JOIN subject s ON s.id_subject = c.id_subject
             LEFT JOIN section sec ON sec.id_section = c.id_section
             LEFT JOIN class_topic ct ON ct.id_class = c.id_class
             LEFT JOIN topic t ON t.id_topic = ct.id_topic
             WHERE c.id_class = ?
             GROUP BY c.id_class`,
            [classId]
        );
        const meta = classMetaResult.rows[0] || { subject: 'General', level: 'N/A', topics: '' };

        for (const topic of topicResult.rows) {
            try {
                console.log('');
                console.log('─'.repeat(60));
                console.log(`📘 Topic: ${topic.name} (ID: ${topic.id_topic})`);
                console.log(`📊 Score Average: ${topic.score_average ?? 'N/A'}%`);

                // Get correlations for this topic
                const correlationResult = await db.query<{
                    related_name: string;
                    relation_type: string;
                    correlation_coefficient: number;
                }>(
                    `SELECT 
                        CASE WHEN tfr.id_topic_father = ? THEN ts.name ELSE tf.name END as related_name,
                        CASE WHEN tfr.id_topic_father = ? THEN 'padre_de' ELSE 'hijo_de' END as relation_type,
                        tfr.correlation_coefficient
                     FROM topic_father_son_relation tfr
                     INNER JOIN topic tf ON tf.id_topic = tfr.id_topic_father
                     INNER JOIN topic ts ON ts.id_topic = tfr.id_topic_son
                     WHERE tfr.id_topic_father = ? OR tfr.id_topic_son = ?`,
                    [topic.id_topic, topic.id_topic, topic.id_topic, topic.id_topic]
                );

                console.log(`🔗 Correlations found: ${correlationResult.rows.length}`);

                // Get students who completed this topic
                const completedResult = await db.query<{ completed: number }>(
                    `SELECT COUNT(DISTINCT id_user) as completed 
                     FROM class_student_topic 
                     WHERE id_class = ? AND id_topic = ? AND score IS NOT NULL`,
                    [classId, topic.id_topic]
                );
                const studentsCompleted = completedResult.rows[0]?.completed || 0;

                console.log(`👥 Students completed: ${studentsCompleted}/${totalStudents}`);

                // Find question stats for this topic
                const topicQStats = questionStats.find(qs => qs.topicId === topic.id_topic);

                if (topicQStats) {
                    console.log(`❓ Questions: ${topicQStats.count} (avg frustration: ${topicQStats.avgFrustration})`);
                }

                // Build related topics string
                const relatedTopics = correlationResult.rows.map((r) =>
                    `${r.related_name} (${r.relation_type})`
                ).join(', ') || 'Ninguno';

                const correlations = correlationResult.rows.map((r) =>
                    `${r.related_name}: ${r.correlation_coefficient}`
                ).join(', ') || 'N/A';

                // Build question summary
                const questionSummary = topicQStats
                    ? topicQStats.sampleQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
                    : 'Sin preguntas registradas';

                // Build chat conclusions for this topic (filter by topic name in weaknesses)
                const relevantConclusions = chatConclusions
                    .filter(c => {
                        const weaknessesStr = JSON.stringify(c.weaknesses).toLowerCase();
                        return weaknessesStr.includes(topic.name.toLowerCase());
                    })
                    .map(c => c.summary)
                    .slice(0, 3)
                    .join('\n') || 'Sin conclusiones específicas';

                // Build the prompt with Task Parameters
                const prompt = TOPIC_CLASS_SUMMARY_PROMPT
                    .replace('{TOPIC_NAME}', topic.name)
                    .replace('{TOPIC_SCORE}', String(topic.score_average || 0))
                    .replace('{STUDENTS_COMPLETED}', String(studentsCompleted))
                    .replace('{TOTAL_STUDENTS}', String(totalStudents))
                    .replace('{STUDENT_QUESTIONS}', questionSummary)
                    .replace('{AVG_FRUSTRATION}', topicQStats?.avgFrustration || 'low')
                    .replace('{SUBJECT}', meta.subject)
                    .replace('{LEVEL}', meta.level)
                    .replace('{TOPICS_LIST}', meta.topics)
                    .replace('{LANGUAGE}', 'Spanish');

                const aiResponse = await generateContentWithGemini(
                    `JSON breve del tópico ${topic.name}:`, prompt
                );

                const parsed = parseInsightResponse(aiResponse);
                const summaryToSave = parsed ? JSON.stringify(parsed) : aiResponse;

                await db.query(
                    `UPDATE class_topic 
                     SET ai_summary = ?, last_analysis_at = CURRENT_TIMESTAMP
                     WHERE id_class = ? AND id_topic = ?`,
                    [summaryToSave, classId, topic.id_topic]
                );

                successCount++;
                console.log(`  ✅ ${topic.name} (${topic.score_average || 0}%)`);

            } catch (topicErr: any) {
                console.error(`  ❌ ${topic.name}:`, topicErr?.message || topicErr);
            }
        }

        // 6. Mark chatbot questions as synced (if the table exists)
        try {
            const unsyncedQuestions = await getUnsyncedQuestions(classId);
            if (unsyncedQuestions.length > 0) {
                const ids = unsyncedQuestions.map(q => q.id_log);
                await markAsSynced(ids);
                console.log(`📝 Marked ${ids.length} chatbot questions as synced`);
            }
        } catch (e) {
            // Non-fatal: table may not exist yet
            console.warn('⚠️  Could not mark questions as synced (table may not exist)');
        }

        console.log('');
        console.log(`✅ Phase 4 complete - ${successCount}/${topicResult.rows.length} topic summaries generated`);

        broadcastInsightUpdate(`📚 Phase 4 Complete: ${successCount} topic summaries generated`, {
            phase: 4,
            status: 'complete',
            successCount,
            totalTopics: topicResult.rows.length
        });

    } catch (err) {
        console.error('💥 Fatal error in topic summary generation:', err);
        broadcastInsightUpdate('💥 Phase 4 Error: Failed to generate topic summaries', {
            phase: 4,
            status: 'error',
            error: String(err)
        });
    }
}
// ============================================================
// Phase 5: Generate section_topic.ai_summary
// Super simple: for each section_topic row, get class_topic summaries and combine
// ============================================================
export async function generateSectionTopicSummaries(sectionId?: number): Promise<void> {
    console.log('[Phase 5] START');

    try {
        // Step 1: Get all section_topic rows that need summaries
        const condition = sectionId ? `WHERE st.id_section = ?` : '';
        const params = sectionId ? [sectionId] : [];

        const rows = await db.query<{
            id_section: number;
            id_topic: number;
            topic_name: string;
            score: number | null;
        }>(
            `SELECT st.id_section, st.id_topic, t.name as topic_name, st.score
             FROM section_topic st
             INNER JOIN topic t ON t.id_topic = st.id_topic
             ${condition}`,
            params
        );

        console.log(`[Phase 5] Found ${rows.rows.length} section_topic rows`);
        if (rows.rows.length === 0) return;

        const { SECTION_TOPIC_SUMMARY_PROMPT } = await import('../config/prompts.js');
        let success = 0;

        for (const row of rows.rows) {
            try {
                console.log(`[Phase 5] Processing: section=${row.id_section} topic=${row.id_topic} (${row.topic_name})`);

                // Step 2: Get class_topic summaries for this specific topic in classes of this section
                const ctRows = await db.query<{ ai_summary: string }>(
                    `SELECT ct.ai_summary
                     FROM class_topic ct
                     INNER JOIN class c ON c.id_class = ct.id_class
                     WHERE c.id_section = ? AND ct.id_topic = ? AND ct.ai_summary IS NOT NULL
                     LIMIT 3`,
                    [row.id_section, row.id_topic]
                );

                console.log(`[Phase 5]   class_topic summaries found: ${ctRows.rows.length}`);

                // Extract text from JSON summaries
                const texts: string[] = [];
                for (const ct of ctRows.rows) {
                    try {
                        const parsed = JSON.parse(ct.ai_summary);
                        texts.push((parsed.summary || '').substring(0, 120));
                    } catch {
                        texts.push(ct.ai_summary.substring(0, 120));
                    }
                }
                const classSummaries = texts.join(' | ') || 'Sin datos de clases';
                console.log(`[Phase 5]   Context: "${classSummaries.substring(0, 80)}"`);

                // Step 3: Build prompt and call AI
                // Fetch context metadata for Section
                const sectionMetaResult = await db.query<{ subject: string, level: string, topics: string }>(
                    `SELECT 
                        s.name_subject as subject,
                        sec.grade as level,
                        GROUP_CONCAT(DISTINCT t.name separator ', ') as topics
                     FROM section sec
                     LEFT JOIN class c ON c.id_section = sec.id_section
                     LEFT JOIN subject s ON s.id_subject = c.id_subject
                     LEFT JOIN topic t ON t.id_subject = s.id_subject
                     WHERE sec.id_section = ?
                     GROUP BY sec.id_section`,
                    [row.id_section]
                );
                const sMeta = sectionMetaResult.rows[0] || { subject: 'General', level: 'N/A', topics: '' };

                const prompt = SECTION_TOPIC_SUMMARY_PROMPT
                    .replace('{TOPIC_NAME}', row.topic_name)
                    .replace('{SECTION_NAME}', `Sección ${row.id_section}`)
                    .replace('{TOPIC_SCORE}', String(row.score || 0))
                    .replace('{CLASS_SUMMARIES}', classSummaries)
                    .replace('{SUBJECT}', sMeta.subject)
                    .replace('{LEVEL}', sMeta.level)
                    .replace('{TOPICS_LIST}', sMeta.topics)
                    .replace('{LANGUAGE}', 'Spanish');

                console.log(`[Phase 5]   Calling Gemini...`);
                const aiResponse = await generateContentWithGemini(prompt, 'Responde solo JSON válido.');
                console.log(`[Phase 5]   Response (${aiResponse.length} chars): ${aiResponse.substring(0, 120)}`);

                // Step 4: Save
                const parsed = parseInsightResponse(aiResponse);
                const toSave = parsed ? JSON.stringify(parsed) : aiResponse;
                console.log(`[Phase 5]   Parsed: ${!!parsed}, saving ${toSave.length} chars`);

                await db.query(
                    `UPDATE section_topic SET ai_summary = ?, last_analysis_at = CURRENT_TIMESTAMP
                     WHERE id_section = ? AND id_topic = ?`,
                    [toSave, row.id_section, row.id_topic]
                );

                success++;
                console.log(`[Phase 5]   ✅ SAVED ${row.topic_name}`);
            } catch (err: any) {
                console.error(`[Phase 5]   ❌ FAILED ${row.topic_name}: ${err?.message}`);
            }
        }

        console.log(`[Phase 5] DONE — ${success}/${rows.rows.length} saved`);
    } catch (err: any) {
        console.error(`[Phase 5] FATAL ERROR: ${err?.message}`);
        console.error(err);
    }
}

/**
 * Phase 4.5: Generate AI summary of student questions for a specific class
 */
export async function generateClassQuestionsSummary(classId: number): Promise<void> {
    console.log(`[Phase 4.5] ❓ Summarizing questions for class ${classId}`);
    try {
        // 1. Get recent questions
        const questions = await db.query<{ question_text: string; topic_detected: string | null; frustration_level: string }>(
            `SELECT question_text, topic_detected, frustration_level 
             FROM chatbot_question_log WHERE id_class = ? ORDER BY created_at DESC LIMIT 20`,
            [classId]
        );
        if (questions.rows.length === 0) {
            console.log(`[Phase 4.5] No questions found for class ${classId}`);
            return;
        }

        // 2. Fetch class metadata
        const classMetaResult = await db.query<{ subject: string, level: string, topics: string }>(
            `SELECT 
                s.name_subject as subject,
                sec.grade as level,
                GROUP_CONCAT(DISTINCT t.name separator ', ') as topics
             FROM class c
             LEFT JOIN subject s ON s.id_subject = c.id_subject
             LEFT JOIN section sec ON sec.id_section = c.id_section
             LEFT JOIN class_topic ct ON ct.id_class = c.id_class
             LEFT JOIN topic t ON t.id_topic = ct.id_topic
             WHERE c.id_class = ?
             GROUP BY c.id_class`,
            [classId]
        );
        const meta = classMetaResult.rows[0] || { subject: 'General', level: 'N/A', topics: '' };

        // 3. Prep context
        const questionList = questions.rows.map(q => 
            `[${q.frustration_level}] ${q.topic_detected || '?'}: ${q.question_text.substring(0, 80)}`
        ).join('\n');

        // 4. Call AI
        const prompt = QUESTIONS_SUMMARY_PROMPT
            .replace('{SUBJECT}', meta.subject)
            .replace('{LEVEL}', meta.level)
            .replace('{TOPICS_LIST}', meta.topics)
            .replace('{QUESTION_COUNT}', String(questions.rows.length))
            .replace('{LANGUAGE}', 'Spanish')
            .replace('{QUESTION_LIST}', questionList);

        const aiResp = await generateContentWithGemini(prompt, 'Responde solo JSON.');
        const parsed = parseInsightResponse(aiResp);

        if (!parsed) {
            console.error(`[Phase 4.5] Failed to parse AI response for class ${classId}`);
            return;
        }

        // 5. Save to DB
        await db.query(
            `INSERT INTO class_questions_summary (id_class, questions_summary, top_doubts, total_questions, avg_frustration, generated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                classId, 
                parsed.questions_summary, 
                JSON.stringify(parsed.top_doubts || []), 
                questions.rows.length, 
                parsed.avg_frustration || 'media'
            ]
        );

        console.log(`[Phase 4.5] ✅ Questions summary saved for class ${classId}`);
    } catch (err: any) {
        console.error(`[Phase 4.5] ❌ Error in questions summary:`, err?.message);
    }
}

