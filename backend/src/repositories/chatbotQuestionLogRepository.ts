import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../db/pool.js';

// ============================================================
// chatbot_question_log repository
// Stores structured metadata for every student chatbot question
// ============================================================

export interface QuestionLogRow extends RowDataPacket {
    id_log: number;
    id_user: number;
    id_class: number | null;
    id_subject: number;
    topic_detected: string | null;
    id_topic_detected: number | null;
    frustration_level: 'low' | 'medium' | 'high';
    question_text: string;
    ai_response_summary: string | null;
    is_synced_to_report: boolean;
    created_at: Date;
    // Joined fields (optional)
    user_name?: string;
    user_last_name?: string;
    topic_name?: string;
}

/**
 * Log a classified question from the chatbot
 */
export async function logQuestion(params: {
    userId: number;
    classId?: number | null;
    subjectId: number;
    topicDetected?: string | null;
    topicIdDetected?: number | null;
    frustrationLevel: 'low' | 'medium' | 'high';
    questionText: string;
    aiResponseSummary?: string | null;
}): Promise<void> {
    try {
        await db.query<ResultSetHeader>(
            `INSERT INTO chatbot_question_log 
             (id_user, id_class, id_subject, topic_detected, id_topic_detected, frustration_level, question_text, ai_response_summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                params.userId,
                params.classId ?? null,
                params.subjectId,
                params.topicDetected ?? null,
                params.topicIdDetected ?? null,
                params.frustrationLevel,
                params.questionText,
                params.aiResponseSummary ?? null
            ]
        );
    } catch (err) {
        console.error('[QuestionLog] Failed to log question:', err);
        // Fire-and-forget: don't throw
    }
}

/**
 * Get unsynced questions for a specific class (for cron job report generation)
 */
export async function getUnsyncedQuestions(classId?: number | null): Promise<QuestionLogRow[]> {
    let query = `SELECT * FROM chatbot_question_log WHERE is_synced_to_report = FALSE`;
    const params: any[] = [];

    if (classId !== undefined && classId !== null) {
        query += ` AND id_class = ?`;
        params.push(classId);
    }

    query += ` ORDER BY created_at ASC`;

    const result = await db.query<QuestionLogRow>(query, params);
    return result.rows;
}

/**
 * Mark questions as synced after being included in a report
 */
export async function markAsSynced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.query<ResultSetHeader>(
        `UPDATE chatbot_question_log SET is_synced_to_report = TRUE WHERE id_log IN (${placeholders})`,
        ids
    );
}

/**
 * Get questions for professor dashboard view
 * Supports filtering by class, subject, and pagination
 */
export async function getQuestionsByClass(params: {
    classId?: number | null;
    subjectId?: number | null;
    limit?: number;
    offset?: number;
}): Promise<{ questions: QuestionLogRow[]; total: number }> {
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.classId !== undefined && params.classId !== null) {
        conditions.push('cql.id_class = ?');
        queryParams.push(params.classId);
    }

    if (params.subjectId !== undefined && params.subjectId !== null) {
        conditions.push('cql.id_subject = ?');
        queryParams.push(params.subjectId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    // Get total count
    const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*) as total FROM chatbot_question_log cql ${whereClause}`,
        queryParams
    );
    const total = countResult.rows[0]?.total || 0;

    // Get paginated results with user info
    const result = await db.query<QuestionLogRow>(
        `SELECT cql.*, u.name as user_name, u.last_name as user_last_name
         FROM chatbot_question_log cql
         LEFT JOIN \`user\` u ON u.id_user = cql.id_user
         ${whereClause}
         ORDER BY cql.created_at DESC
         LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
    );

    return { questions: result.rows, total };
}

/**
 * Get aggregated question stats by topic for a class
 * Used for per-topic summaries
 */
export async function getQuestionStatsByTopic(classId?: number | null): Promise<{
    topic: string;
    topicId: number | null;
    count: number;
    avgFrustration: string;
    sampleQuestions: string[];
}[]> {
    const conditions = ['is_synced_to_report = FALSE'];
    const params: any[] = [];

    if (classId !== undefined && classId !== null) {
        conditions.push('id_class = ?');
        params.push(classId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query<{
        topic_detected: string;
        id_topic_detected: number | null;
        question_count: number;
        high_count: number;
        medium_count: number;
        low_count: number;
    }>(
        `SELECT 
            COALESCE(topic_detected, 'Sin tema') as topic_detected,
            id_topic_detected,
            COUNT(*) as question_count,
            SUM(CASE WHEN frustration_level = 'high' THEN 1 ELSE 0 END) as high_count,
            SUM(CASE WHEN frustration_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN frustration_level = 'low' THEN 1 ELSE 0 END) as low_count
         FROM chatbot_question_log
         ${whereClause}
         GROUP BY topic_detected, id_topic_detected
         ORDER BY question_count DESC`,
        params
    );

    // Get sample questions for each topic
    const stats = [];
    for (const row of result.rows) {
        const sampleResult = await db.query<{ question_text: string }>(
            `SELECT question_text FROM chatbot_question_log
             WHERE COALESCE(topic_detected, 'Sin tema') = ? ${classId ? 'AND id_class = ?' : ''}
             ORDER BY created_at DESC LIMIT 3`,
            classId ? [row.topic_detected, classId] : [row.topic_detected]
        );

        // Determine average frustration
        const total = row.question_count;
        let avgFrustration = 'low';
        if (row.high_count > total * 0.4) avgFrustration = 'high';
        else if (row.medium_count + row.high_count > total * 0.3) avgFrustration = 'medium';

        stats.push({
            topic: row.topic_detected,
            topicId: row.id_topic_detected,
            count: row.question_count,
            avgFrustration,
            sampleQuestions: sampleResult.rows.map(r => r.question_text)
        });
    }

    return stats;
}
