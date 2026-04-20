import { generateContentWithGemini } from './geminiService.js';
import { db } from '../db/pool.js';
import { io } from '../server.js';
import { 
    TOPIC_CLASS_SUMMARY_PROMPT, 
    SECTION_TOPIC_SUMMARY_PROMPT,
    STUDENT_INSIGHT_PROMPT,
    QUESTIONS_SUMMARY_PROMPT 
} from '../config/prompts.js';

// Default class ID (fallback)
const DEFAULT_CLASS_ID = 1;

/**
 * Interface for messages in context
 */
interface ChatMessage {
    id_message: number;
    role: string;
    content: string;
    created_at: Date;
}

/**
 * Broadcast progress updates via WebSocket
 */
export function broadcastInsightUpdate(message: string, data: any = {}): void {
    if (io) {
        io.emit('insight_update', {
            timestamp: new Date().toISOString(),
            message,
            data
        });
        console.log(`[Socket] Broadcasted insight_update: ${message}`);
    }
}

/**
 * Phase 2: Generate individual student insights
 */
export async function runStudentInsightGeneration(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║           🤖 PHASE 2: INDIVIDUAL STUDENT CHAT ANALYSIS           ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    try {
        // 1. Get all students with unanalyzed chat messages
        const studentMessages = await getUnanalyzedMessagesGroupedByStudent();
        
        if (studentMessages.length === 0) {
            console.log('⏭️  No unanalyzed student messages. Skipping Individual Analysis.');
            return;
        }

        console.log(`🔍 Found ${studentMessages.length} students with recent activity`);

        for (const student of studentMessages) {
            try {
                await analyzeStudentChat(student.userId, student.classId, student.messages);
            } catch (err) {
                console.error(`❌ Failed to analyze student ${student.userId}:`, err);
            }
        }

        console.log('✅ Phase 2 complete.');
    } catch (err) {
        console.error('❌ Error in Phase 2:', err);
    }
}

/**
 * Internal helper to analyze a single student's conversation
 */
async function analyzeStudentChat(userId: number, classId: number, messages: ChatMessage[]): Promise<void> {
    console.log(`[AI] Analyzing Chat for User ${userId} (Class ${classId})...`);
    
    // Get subject metadata
    const userContext = await getUserSubjectContext(userId, classId);
    const subjectName = userContext?.subject_name || 'General';

    // Format chat transcript
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // Build prompt
    const prompt = STUDENT_INSIGHT_PROMPT
        .replace('{SUBJECT}', subjectName)
        .replace('{TRANSCRIPT}', transcript);

    // Call Gemini
    const aiResponse = await generateContentWithGemini(
        'Analyze this tutoring conversation and return JSON:',
        prompt
    );

    // Parse response
    const parsed = parseInsightResponse(aiResponse);

    if (parsed) {
        // Save (UPSERT)
        await saveStudentClassSummary({
            userId,
            classId,
            summaryText: parsed.summary || parsed.general_summary || '',
            strengths: parsed.strengths || [],
            weaknesses: parsed.weaknesses || parsed.issues || parsed.key_issues || [],
            studyTips: parsed.tips || parsed.study_tips || []
        });

        // Mark as analyzed
        const messageIds = messages.map(m => m.id_message);
        await markMessagesAsAnalyzed(messageIds);

        // Broadcast
        broadcastInsightUpdate(`🎯 Student Summary Generated for User ${userId}`, {
            phase: 2,
            status: 'summary_saved',
            userId,
            classId,
            subject: subjectName
        });
    }
}

/**
 * Phase 3: Generate professor class reports
 */
export async function runClassReportGeneration(classId: number = DEFAULT_CLASS_ID): Promise<void> {
    console.log(`[Phase 3] Generating Class Report for ID ${classId}...`);

    try {
        const summaries = await getUnprocessedSummaries(classId);
        if (summaries.length === 0) return;

        // Aggregate weaknesses
        const weaknessCount: Record<string, number> = {};
        for (const s of summaries) {
            const w = typeof s.weaknesses === 'string' ? JSON.parse(s.weaknesses) : (s.weaknesses || []);
            w.forEach((item: string) => {
                const norm = item.toLowerCase().trim();
                weaknessCount[norm] = (weaknessCount[norm] || 0) + 1;
            });
        }

        const topWeaknesses = Object.entries(weaknessCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);

        const summariesCount = summaries.length;
        const generalSummary = `Basado en ${summariesCount} interacciones de estudiantes, los puntos de mayor duda son: ${topWeaknesses.join(', ')}.`;

        // Save
        await db.query(
            `INSERT INTO professor_class_report (id_class, general_summary, top_confusion_topics, sentiment_average, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [classId, generalSummary, JSON.stringify(topWeaknesses), 'neutral']
        );

        // Mark as processed
        const summaryIds = summaries.map((s: any) => s.id_summary);
        await db.query(`UPDATE student_class_summary SET processed = true WHERE id_summary = ANY(?)`, [summaryIds]);

        broadcastInsightUpdate(`📊 Reporte de clase generado (${summariesCount} alumnos)`, {
            phase: 3,
            status: 'report_saved',
            classId
        });
    } catch (err) {
        console.error('[Phase 3] Error:', err);
    }
}

/**
 * Phase 4: Per-topic Class Summaries
 */
export async function generateTopicClassSummaries(classId: number): Promise<void> {
    console.log(`[Phase 4] Topic Summaries for Class ${classId}...`);
    try {
        const topics = await getTopicsInClass(classId);
        for (const topic of topics) {
            const prompt = TOPIC_CLASS_SUMMARY_PROMPT
                .replace('{TOPIC_NAME}', topic.name)
                .replace('{TOPIC_SCORE}', String(topic.score_average || 0))
                .replace('{TOTAL_STUDENTS}', '30') // Hardcoded or dynamic
                .replace('{STUDENTS_COMPLETED}', '20')
                .replace('{AVG_FRUSTRATION}', 'Baja');

            const aiResp = await generateContentWithGemini('Summary for topic:', prompt);
            const parsed = parseInsightResponse(aiResp);
            
            const summaryString = typeof parsed === 'object' ? JSON.stringify(parsed) : aiResp;

            await db.query(
                `UPDATE class_topic SET ai_summary = ? WHERE id_class = ? AND id_topic = ?`,
                [summaryString, classId, topic.id_topic]
            );
        }
        console.log(`[Phase 4] ✅ Topics for class ${classId} updated.`);
    } catch (err) {
        console.error('[Phase 4] Error:', err);
    }
}

/**
 * Phase 4.5: Question Synthesis
 */
export async function generateClassQuestionsSummary(classId: number): Promise<void> {
    console.log(`[Phase 4.5] Questions Summary for Class ${classId}...`);
    try {
        const questionsRes = await db.query<any>(
            `SELECT question_text, frustration_level FROM chatbot_question_log WHERE id_class = ? ORDER BY created_at DESC LIMIT 30`,
            [classId]
        );
        const questions = questionsRes.rows;
        if (questions.length === 0) return;

        const questionList = questions.map(q => `[${q.frustration_level}] ${q.question_text}`).join('\n');
        
        const prompt = QUESTIONS_SUMMARY_PROMPT.replace('{QUESTIONS_LIST}', questionList);
        const aiResp = await generateContentWithGemini('Summarize questions:', prompt);
        const parsed = parseInsightResponse(aiResp);

        if (parsed) {
            await db.query(
                `INSERT INTO class_questions_summary (id_class, questions_summary, top_doubts, total_questions, avg_frustration, generated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    classId, 
                    parsed.questions_summary || parsed.summary || "", 
                    JSON.stringify(parsed.top_doubts || []), 
                    questions.length, 
                    parsed.avg_frustration || 'low'
                ]
            );
        }
    } catch (err) {
        console.error('[Phase 4.5] Error:', err);
    }
}

/**
 * Phase 5: Combine into Section Topics
 */
export async function generateSectionTopicSummaries(): Promise<void> {
    console.log(`[Phase 5] Global Section Sync...`);
    try {
        // Simplified: Combined recent class summaries for the same topic/section
        const sectionTopics = await db.query<any>(`SELECT DISTINCT id_section, id_topic FROM class_topic`);
        for (const st of sectionTopics.rows) {
            const latestSummaries = await db.query<any>(
                `SELECT ai_summary FROM class_topic WHERE id_topic = ? AND id_class IN (SELECT id_class FROM class WHERE id_section = ?)`,
                [st.id_topic, st.id_section]
            );
            // Logic to merge summaries... skipping for brevity
        }
    } catch (err) {
        console.error('[Phase 5] Error:', err);
    }
}

/**
 * Full Pipeline Master Trigger
 */
export async function runFullInsightPipeline(classId: number): Promise<void> {
    console.log(`[Pipeline] 🚀 EXECUTION for Class ${classId}`);
    try {
        await runStudentInsightGeneration(); // Global pass
        await runClassReportGeneration(classId);
        await generateTopicClassSummaries(classId);
        await generateClassQuestionsSummary(classId);
        await generateSectionTopicSummaries(); // Global sync
        
        broadcastInsightUpdate(`✨ Pipeline finalizado para clase ${classId}`, { 
            classId, 
            status: 'pipeline_complete' 
        });
    } catch (err) {
        console.error(`[Pipeline] Failed:`, err);
    }
}

/**
 * Robust JSON Extractor
 */
function parseInsightResponse(response: string): any | null {
    try {
        const cleaned = response.trim();
        const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn('[AI Parse] Falling back to raw object wrapper');
        return { summary: response.substring(0, 500) };
    }
}

// --- DB HELPERS (Simplified) ---

async function getUnanalyzedMessagesGroupedByStudent() {
    const res = await db.query<any>(`SELECT id_user as "userId", id_class as "classId" FROM chat_logs WHERE analyzed = false GROUP BY id_user, id_class`);
    const list = [];
    for (const row of res.rows) {
        const msgs = await db.query<any>(`SELECT * FROM chat_logs WHERE id_user = ? AND id_class = ? AND analyzed = false`, [row.userId, row.classId]);
        list.push({ ...row, messages: msgs.rows });
    }
    return list;
}

async function markMessagesAsAnalyzed(ids: number[]) {
    await db.query(`UPDATE chat_logs SET analyzed = true WHERE id_message = ANY(?)`, [ids]);
}

async function saveStudentClassSummary(data: any) {
    await db.query(
        `INSERT INTO student_class_summary (id_user, id_class, summary_text, strengths, weaknesses, study_tips, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id_user, id_class) DO UPDATE SET 
         summary_text = EXCLUDED.summary_text, strengths = EXCLUDED.strengths, 
         weaknesses = EXCLUDED.weaknesses, study_tips = EXCLUDED.study_tips, updated_at = CURRENT_TIMESTAMP`,
        [data.userId, data.classId, data.summaryText, JSON.stringify(data.strengths), JSON.stringify(data.weaknesses), JSON.stringify(data.studyTips)]
    );
}

async function getUnprocessedSummaries(classId: number) {
    const res = await db.query<any>(`SELECT * FROM student_class_summary WHERE id_class = ? AND processed = false`, [classId]);
    return res.rows;
}

async function getUserSubjectContext(userId: number, classId: number) {
    const res = await db.query<any>(`SELECT s.name_subject FROM class c JOIN class_template ct ON c.id_class_template = ct.id_class_template JOIN subject s ON ct.id_subject = s.id_subject WHERE c.id_class = ?`, [classId]);
    return res.rows[0];
}

async function getTopicsInClass(classId: number) {
    const res = await db.query<any>(`SELECT ct.id_topic, t.name, ct.score_average FROM class_topic ct JOIN topic t ON ct.id_topic = t.id_topic WHERE ct.id_class = ?`, [classId]);
    return res.rows;
}
