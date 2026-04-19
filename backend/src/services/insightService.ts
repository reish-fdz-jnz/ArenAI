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

                // Build the prompt (same replace pattern as generateTopicMasteryInsight)
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

                console.log('');
                console.log('🤖 Calling Gemini AI for topic summary...');

                // Call Gemini (same pattern as processUserSummary)
                const aiResponse = await generateContentWithGemini(
                    `Analiza el estado de este tópico en la clase y genera el JSON:`,
                    prompt
                );

                console.log('');
                console.log('🎯 TOPIC SUMMARY RESULT:');
                console.log('─'.repeat(40));
                console.log(aiResponse.substring(0, 500) + (aiResponse.length > 500 ? '\n... [truncated]' : ''));
                console.log('─'.repeat(40));

                // Parse response (same pattern as processUserSummary)
                const parsed = parseInsightResponse(aiResponse);
                const summaryToSave = parsed ? JSON.stringify(parsed) : aiResponse;

                // Save AI summary to class_topic (same UPDATE pattern as updatePermanentTopicSummary)
                await db.query(
                    `UPDATE class_topic 
                     SET ai_summary = ?, last_analysis_at = CURRENT_TIMESTAMP
                     WHERE id_class = ? AND id_topic = ?`,
                    [summaryToSave, classId, topic.id_topic]
                );

                successCount++;

                console.log('');
                console.log(`✅ TOPIC SUMMARY SAVED for: ${topic.name}`);
                if (parsed) {
                    console.log(`   📖 Summary: ${(parsed.summary || '').substring(0, 100)}...`);
                    console.log(`   ⚠️  Key Issues: ${JSON.stringify(parsed.key_issues || [])}`);
                    console.log(`   💡 Actions: ${JSON.stringify(parsed.recommended_actions || [])}`);
                }

                // Broadcast to frontend (same pattern as Phase 2)
                broadcastInsightUpdate(`📘 Topic Summary Generated: ${topic.name}`, {
                    phase: 4,
                    status: 'topic_summary_saved',
                    topicId: topic.id_topic,
                    topicName: topic.name,
                    scoreAverage: topic.score_average
                });

            } catch (topicErr) {
                console.error(`❌ Failed to process topic ${topic.name}:`, topicErr);
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
// Phase 5: Generate per-topic SECTION summaries
// Aggregates data from ALL students in a section, across all classes
// ============================================================
export async function generateSectionTopicSummaries(sectionId?: number): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        🏫 PHASE 5: SECTION TOPIC SUMMARY GENERATION             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    try {
        // 1. Get sections to process
        let sectionIds: number[] = [];
        if (sectionId) {
            sectionIds = [sectionId];
        } else {
            const sectionResult = await db.query<{ id_section: number }>(
                `SELECT DISTINCT id_section FROM section_topic`
            );
            sectionIds = sectionResult.rows.map(r => r.id_section);
        }

        if (sectionIds.length === 0) {
            console.log('⏭️  No sections with topics found. Skipping Phase 5.');
            broadcastInsightUpdate('🔍 No sections with topics found', {
                phase: 5,
                status: 'skipped',
                reason: 'No section_topic records'
            });
            return;
        }

        console.log(`📊 Found ${sectionIds.length} sections to analyze`);

        broadcastInsightUpdate(`🏫 Phase 5 Starting: ${sectionIds.length} sections to analyze`, {
            phase: 5,
            status: 'started',
            sectionCount: sectionIds.length
        });

        let totalSuccess = 0;

        for (const secId of sectionIds) {
            try {
                // 2. Get section info
                const sectionInfo = await db.query<{ section_number: string; grade: string }>(
                    `SELECT section_number, grade FROM section WHERE id_section = ?`,
                    [secId]
                );
                const sectionName = sectionInfo.rows[0]
                    ? `${sectionInfo.rows[0].grade}-${sectionInfo.rows[0].section_number}`
                    : `Sección ${secId}`;

                console.log(`\n🏫 Processing section: ${sectionName} (ID: ${secId})`);

                // 3. Get topics for this section
                const topicResult = await db.query<{
                    id_topic: number;
                    topic_name: string;
                    score: number | null;
                }>(
                    `SELECT st.id_topic, t.name as topic_name, st.score
                     FROM section_topic st
                     INNER JOIN topic t ON t.id_topic = st.id_topic
                     WHERE st.id_section = ?`,
                    [secId]
                );

                if (topicResult.rows.length === 0) {
                    console.log(`⏭️  No topics for section ${secId}`);
                    continue;
                }

                console.log(`📘 ${topicResult.rows.length} topics to process`);

                // 4. Get students in this section
                const studentResult = await db.query<{ id_user: number }>(
                    `SELECT us.id_user FROM user_section us
                     INNER JOIN student_profile sp ON sp.id_user = us.id_user
                     WHERE us.id_section = ?`,
                    [secId]
                );
                const studentIds = studentResult.rows.map(r => r.id_user);
                const totalStudents = studentIds.length;
                console.log(`👥 ${totalStudents} students in section`);

                // 5. Get chatbot question stats (wrapped in try/catch)
                let questionStats: Awaited<ReturnType<typeof getQuestionStatsByTopic>> = [];
                try {
                    // Get questions from students in this section
                    const classesInSection = await db.query<{ id_class: number }>(
                        `SELECT id_class FROM class WHERE id_section = ?`,
                        [secId]
                    );
                    for (const cls of classesInSection.rows) {
                        const stats = await getQuestionStatsByTopic(cls.id_class);
                        questionStats.push(...stats);
                    }
                } catch (e) {
                    console.warn('⚠️  Could not fetch question stats');
                }

                // 6. Get student class summaries for context
                const summaryResult = await db.query<{
                    summary_text: string;
                    weaknesses: string | string[] | null;
                }>(
                    `SELECT scs.summary_text, scs.weaknesses
                     FROM student_class_summary scs
                     WHERE scs.id_user IN (${studentIds.length > 0 ? studentIds.map(() => '?').join(',') : '0'})`,
                    studentIds.length > 0 ? studentIds : [0]
                );

                const chatConclusions = summaryResult.rows.map(s => {
                    const weaknesses = typeof s.weaknesses === 'string'
                        ? JSON.parse(s.weaknesses)
                        : (s.weaknesses || []);
                    return { summary: s.summary_text, weaknesses: weaknesses as string[] };
                });

                // 7. Process each topic
                for (const topic of topicResult.rows) {
                    try {
                        console.log(`\n─${'─'.repeat(59)}`);
                        console.log(`📘 Topic: ${topic.topic_name} (ID: ${topic.id_topic})`);

                        // Get student scores for this topic in this section
                        const scoreResult = await db.query<{ score: number }>(
                            `SELECT st.score FROM student_topic st
                             WHERE st.id_user IN (${studentIds.length > 0 ? studentIds.map(() => '?').join(',') : '0'})
                             AND st.id_topic = ? AND st.score IS NOT NULL`,
                            [...(studentIds.length > 0 ? studentIds : [0]), topic.id_topic]
                        );

                        const studentsCompleted = scoreResult.rows.length;
                        const avgScore = studentsCompleted > 0
                            ? Math.round(scoreResult.rows.reduce((s, r) => s + r.score, 0) / studentsCompleted)
                            : (topic.score || 0);

                        console.log(`📊 Score: ${avgScore}% | Completed: ${studentsCompleted}/${totalStudents}`);

                        // Get correlations
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

                        // Get class-level summaries for this topic
                        const classSummaryResult = await db.query<{ ai_summary: string | null; class_name: string }>(
                            `SELECT ct.ai_summary, c.name_session as class_name
                             FROM class_topic ct
                             INNER JOIN class c ON c.id_class = ct.id_class
                             WHERE ct.id_topic = ? AND c.id_section = ? AND ct.ai_summary IS NOT NULL
                             ORDER BY c.start_time DESC LIMIT 3`,
                            [topic.id_topic, secId]
                        );

                        // Build context strings
                        const relatedTopics = correlationResult.rows.map(r =>
                            `${r.related_name} (${r.relation_type})`
                        ).join(', ') || 'Ninguno';

                        const correlations = correlationResult.rows.map(r =>
                            `${r.related_name}: ${r.correlation_coefficient}`
                        ).join(', ') || 'N/A';

                        const topicQStats = questionStats.find(qs => qs.topicId === topic.id_topic);
                        const questionSummary = topicQStats
                            ? topicQStats.sampleQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
                            : 'Sin preguntas registradas';

                        const relevantConclusions = chatConclusions
                            .filter(c => {
                                const weakStr = JSON.stringify(c.weaknesses).toLowerCase();
                                return weakStr.includes(topic.topic_name.toLowerCase());
                            })
                            .map(c => c.summary)
                            .slice(0, 3)
                            .join('\n') || 'Sin conclusiones específicas';

                        const classSummaries = classSummaryResult.rows
                            .map(r => `- ${r.class_name}: ${r.ai_summary?.substring(0, 200)}`)
                            .join('\n') || 'Sin resúmenes de clase';

                        // Build prompt
                        const { SECTION_TOPIC_SUMMARY_PROMPT } = await import('../config/prompts.js');
                        const prompt = SECTION_TOPIC_SUMMARY_PROMPT
                            .replace('{TOPIC_NAME}', topic.topic_name)
                            .replace('{SECTION_NAME}', sectionName)
                            .replace('{TOPIC_SCORE}', String(avgScore))
                            .replace('{STUDENTS_COMPLETED}', String(studentsCompleted))
                            .replace('{TOTAL_STUDENTS}', String(totalStudents))
                            .replace('{RELATED_TOPICS}', relatedTopics)
                            .replace('{CORRELATIONS}', correlations)
                            .replace('{STUDENT_QUESTIONS}', questionSummary)
                            .replace('{AVG_FRUSTRATION}', topicQStats?.avgFrustration || 'low')
                            .replace('{CHAT_CONCLUSIONS}', relevantConclusions)
                            .replace('{CLASS_SUMMARIES}', classSummaries);

                        console.log('🤖 Calling Gemini AI for section topic summary...');

                        const aiResponse = await generateContentWithGemini(
                            `Analiza el estado de este tópico en la sección y genera el JSON:`,
                            prompt
                        );

                        console.log('🎯 SECTION TOPIC SUMMARY RESULT:');
                        console.log('─'.repeat(40));
                        console.log(aiResponse.substring(0, 500));
                        console.log('─'.repeat(40));

                        // Parse and save
                        const parsed = parseInsightResponse(aiResponse);
                        const summaryToSave = parsed ? JSON.stringify(parsed) : aiResponse;

                        await db.query(
                            `UPDATE section_topic 
                             SET ai_summary = ?, score = ?, last_analysis_at = CURRENT_TIMESTAMP
                             WHERE id_section = ? AND id_topic = ?`,
                            [summaryToSave, avgScore, secId, topic.id_topic]
                        );

                        totalSuccess++;
                        console.log(`✅ SECTION TOPIC SUMMARY SAVED for: ${topic.topic_name}`);

                        broadcastInsightUpdate(`🏫 Section Topic Summary: ${topic.topic_name}`, {
                            phase: 5,
                            status: 'section_topic_saved',
                            sectionId: secId,
                            sectionName,
                            topicId: topic.id_topic,
                            topicName: topic.topic_name,
                            score: avgScore
                        });

                    } catch (topicErr) {
                        console.error(`❌ Failed to process topic ${topic.topic_name}:`, topicErr);
                    }
                }

            } catch (sectionErr) {
                console.error(`❌ Failed to process section ${secId}:`, sectionErr);
            }
        }

        console.log(`\n✅ Phase 5 complete - ${totalSuccess} section topic summaries generated`);

        broadcastInsightUpdate(`🏫 Phase 5 Complete: ${totalSuccess} section topic summaries generated`, {
            phase: 5,
            status: 'complete',
            successCount: totalSuccess
        });

    } catch (err) {
        console.error('💥 Fatal error in section topic summary generation:', err);
        broadcastInsightUpdate('💥 Phase 5 Error: Failed to generate section topic summaries', {
            phase: 5,
            status: 'error',
            error: String(err)
        });
    }
}

