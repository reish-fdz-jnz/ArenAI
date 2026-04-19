// Insight Generation Service - REFACTORED for New Schema
// Uses learning_chat_history table for chat storage
// Uses student_class_summary for individual student insights
// Uses professor_class_report for aggregated class reports

import { generateContentWithGemini } from './geminiService.js';
import { 
    TOPIC_MASTERY_PROMPT, 
    STUDENT_INSIGHT_PROMPT, 
    CLASS_REPORT_PROMPT,
    TOPIC_CLASS_SUMMARY_PROMPT
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
// Incorporates scores, correlations, chatbot questions, and chat conclusions
// ============================================================
export async function generateTopicClassSummaries(classId: number = DEFAULT_CLASS_ID): Promise<void> {
    console.log(`\n=== PHASE 4: Topic Class Summaries (classId=${classId}) ===`);
    
    try {
        // 1. Get all topics for this class
        const topicResult = await db.query<any>(
            `SELECT ct.id_topic, t.name, t.id_subject, ct.score_average
             FROM class_topic ct
             INNER JOIN topic t ON t.id_topic = ct.id_topic
             WHERE ct.id_class = ?`,
            [classId]
        );

        if (topicResult.rows.length === 0) {
            console.log('[Phase4] No topics found for this class');
            return;
        }

        console.log(`[Phase4] Processing ${topicResult.rows.length} topics`);

        // 2. Get question stats from chatbot
        let questionStats: any[] = [];
        try {
            questionStats = await getQuestionStatsByTopic(classId);
        } catch (e) {
            console.warn('[Phase4] chatbot_question_log table may not exist yet');
        }

        // 3. Get student class summaries (chat conclusions)
        const summaryResult = await db.query<any>(
            `SELECT summary_text, weaknesses, strengths
             FROM student_class_summary
             WHERE id_class = ?`,
            [classId]
        );
        const chatConclusions = summaryResult.rows.map((s: any) => {
            const weaknesses = typeof s.weaknesses === 'string' ? JSON.parse(s.weaknesses) : s.weaknesses;
            return { summary: s.summary_text, weaknesses: weaknesses || [] };
        });

        // 4. Get student count
        const studentCountResult = await db.query<any>(
            `SELECT COUNT(DISTINCT id_user) as total FROM class_student_topic WHERE id_class = ?`,
            [classId]
        );
        const totalStudents = studentCountResult.rows[0]?.total || 0;

        // 5. For each topic, generate a summary
        for (const topic of topicResult.rows) {
            try {
                // Get correlations for this topic
                const correlationResult = await db.query<any>(
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

                // Get students who completed this topic
                const completedResult = await db.query<any>(
                    `SELECT COUNT(DISTINCT id_user) as completed FROM class_student_topic WHERE id_class = ? AND id_topic = ? AND score IS NOT NULL`,
                    [classId, topic.id_topic]
                );
                const studentsCompleted = completedResult.rows[0]?.completed || 0;

                // Find question stats for this topic
                const topicQStats = questionStats.find(qs => qs.topicId === topic.id_topic);

                // Build related topics string
                const relatedTopics = correlationResult.rows.map((r: any) =>
                    `${r.related_name} (${r.relation_type})`
                ).join(', ') || 'Ninguno';

                const correlations = correlationResult.rows.map((r: any) =>
                    `${r.related_name}: ${r.correlation_coefficient}`
                ).join(', ') || 'N/A';

                // Build question summary
                const questionSummary = topicQStats
                    ? topicQStats.sampleQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
                    : 'Sin preguntas registradas';

                // Build chat conclusions for this topic
                const relevantConclusions = chatConclusions
                    .filter(c => {
                        const weaknessesStr = JSON.stringify(c.weaknesses).toLowerCase();
                        return weaknessesStr.includes(topic.name.toLowerCase());
                    })
                    .map(c => c.summary)
                    .slice(0, 3)
                    .join('\n') || 'Sin conclusiones específicas';

                // Build prompt
                const prompt = TOPIC_CLASS_SUMMARY_PROMPT
                    .replace('{TOPIC_NAME}', topic.name)
                    .replace('{TOPIC_SCORE}', String(topic.score_average || 0))
                    .replace('{STUDENTS_COMPLETED}', String(studentsCompleted))
                    .replace('{TOTAL_STUDENTS}', String(totalStudents))
                    .replace('{RELATED_TOPICS}', relatedTopics)
                    .replace('{CORRELATIONS}', correlations)
                    .replace('{STUDENT_QUESTIONS}', questionSummary)
                    .replace('{AVG_FRUSTRATION}', topicQStats?.avgFrustration || 'low')
                    .replace('{CHAT_CONCLUSIONS}', relevantConclusions);

                // Call Gemini
                const response = await generateContentWithGemini(prompt);

                // Save AI summary to class_topic
                await db.query(
                    `UPDATE class_topic SET ai_summary = ? WHERE id_class = ? AND id_topic = ?`,
                    [response, classId, topic.id_topic]
                );

                console.log(`[Phase4] ✅ Summary generated for topic: ${topic.name}`);
            } catch (topicErr) {
                console.error(`[Phase4] ❌ Failed for topic ${topic.name}:`, topicErr);
            }
        }

        // 6. Mark chatbot questions as synced
        try {
            const unsyncedQuestions = await getUnsyncedQuestions(classId);
            if (unsyncedQuestions.length > 0) {
                const ids = unsyncedQuestions.map(q => q.id_log);
                await markAsSynced(ids);
                console.log(`[Phase4] ✅ Marked ${ids.length} questions as synced`);
            }
        } catch (e) {
            console.warn('[Phase4] ⚠️ Failed to mark questions as synced:', e);
        }

        console.log(`=== PHASE 4 COMPLETE ===\n`);
    } catch (err) {
        console.error('[Phase4] Fatal error:', err);
    }
}
