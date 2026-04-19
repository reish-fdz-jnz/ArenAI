// Insight Generation Service - REFACTORED for New Schema
// Uses learning_chat_history table for chat storage
// Uses student_class_summary for individual student insights
// Uses professor_class_report for aggregated class reports

import { generateContentWithGemini } from './geminiService.js';
import { 
    TOPIC_MASTERY_PROMPT, 
    STUDENT_INSIGHT_PROMPT, 
    CLASS_REPORT_PROMPT 
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
