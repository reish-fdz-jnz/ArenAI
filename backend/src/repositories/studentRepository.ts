import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { StudentProgressRow } from '../types.js';

interface SectionStudentRow {
  id_user: number;
  username: string;
  name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  role_in_section: string | null;
  email_guardian: string | null;
  score_average: string | null;
  quiz_streak: number | null;
}

export async function getStudentTopicProgress(userId: number) {
  const result = await db.query<StudentProgressRow>(
    `SELECT
        st.id_topic,
        t.id_subject,
        t.name AS topic_name,
        s.name_subject AS subject_name,
        st.score
     FROM student_topic st
     INNER JOIN topic t ON t.id_topic = st.id_topic
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE st.id_user = ?
     ORDER BY s.name_subject, t.name`,
    [userId]
  );

  return result.rows;
}

export async function upsertStudentTopicScore(payload: { userId: number; topicId: number; score: number | null }) {
  await db.query<ResultSetHeader>(
    `INSERT INTO student_topic (id_user, id_topic, score)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score)`,
    [payload.userId, payload.topicId, payload.score]
  );

  const result = await db.query<StudentProgressRow>(
    `SELECT
        st.id_topic,
        t.id_subject,
        t.name AS topic_name,
        s.name_subject AS subject_name,
        st.score
     FROM student_topic st
     INNER JOIN topic t ON t.id_topic = st.id_topic
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE st.id_user = ? AND st.id_topic = ?`,
    [payload.userId, payload.topicId]
  );

  return result.rows[0];
}

export async function listStudentsBySection(sectionId: number, institutionId?: number | null) {
  const conditions: string[] = ['us.id_section = ?'];
  const params: any[] = [sectionId];

  if (institutionId) {
    conditions.push('u.id_institution = ?');
    params.push(institutionId);
  }

  const result = await db.query<SectionStudentRow>(
    `SELECT
        u.id_user,
        u.username,
        u.name,
        u.last_name,
        u.email,
        u.phone_number,
        us.role_in_section,
        sp.email_guardian,
        sp.score_average,
        sp.quiz_streak
     FROM user_section us
     INNER JOIN \`user\` u ON u.id_user = us.id_user
     LEFT JOIN student_profile sp ON sp.id_user = u.id_user
     WHERE ${conditions.join(' AND ')}
     ORDER BY u.name, u.last_name, u.username`,
    params
  );

  return result.rows;
}

export interface StudentStats {
  quizzes_completed: number;
  quiz_avg_score: number;
  battles_won: number;
  total_battles: number;
  class_rank: number | null;
}

export async function getStudentStats(userId: number, subjectId?: number): Promise<StudentStats> {
  // Get quiz stats (filtered by subject if provided)
  const quizFilter = subjectId ? 'AND q.id_subject = ?' : '';
  const quizParams = subjectId ? [userId, subjectId] : [userId];

  const quizResult = await db.query<{ quiz_count: number; avg_score: number }>(
    `SELECT 
        COUNT(*) as quiz_count,
        COALESCE(AVG(qa.total_score), 0) as avg_score
     FROM quiz_attempt qa
     INNER JOIN quiz q ON q.id_quiz = qa.id_quiz
     WHERE qa.id_student = ? AND qa.finished_at IS NOT NULL ${quizFilter}`,
    quizParams
  );

  // Get battle stats (global)
  const battleResult = await db.query<{ wins: number; total: number }>(
    `SELECT 
        SUM(CASE 
          WHEN (id_user_1 = ? AND winner = 1) OR (id_user_2 = ? AND winner = 0) 
          THEN 1 ELSE 0 
        END) as wins,
        COUNT(*) as total
     FROM battle_minigame
     WHERE id_user_1 = ? OR id_user_2 = ?`,
    [userId, userId, userId, userId]
  );

  // Get class rank (based on global quiz average or subject average?)
  // User context usually implies global rank, so we keep global rank logic
  const rankResult = await db.query<{ class_rank: number }>(
    `SELECT COUNT(*) + 1 as \`class_rank\`
     FROM (
       SELECT id_student, AVG(total_score) as avg_score
       FROM quiz_attempt
       WHERE finished_at IS NOT NULL
       GROUP BY id_student
     ) scores
     WHERE avg_score > (
       SELECT COALESCE(AVG(total_score), 0)
       FROM quiz_attempt
       WHERE id_student = ? AND finished_at IS NOT NULL
     )`,
    [userId]
  );

  const quizStats = quizResult.rows[0] || { quiz_count: 0, avg_score: 0 };
  const battleStats = battleResult.rows[0] || { wins: 0, total: 0 };
  const rank = rankResult.rows[0]?.class_rank || null;

  return {
    quizzes_completed: quizStats.quiz_count,
    quiz_avg_score: Math.round(quizStats.avg_score),
    battles_won: battleStats.wins || 0,
    total_battles: battleStats.total || 0,
    class_rank: rank,
  };
}

export interface SubjectScore {
  subject_id: number;
  subject_name: string;
  score: number;
  color: string;
}

const SUBJECT_COLORS: { [key: string]: string } = {
  'Math': '#3b82f6',
  'Science': '#10b981',
  'Social Studies': '#f59e0b',
  'Spanish': '#ec4899',
  'default': '#667eea',
};

export async function getStudentSubjectScores(userId: number): Promise<SubjectScore[]> {
  const result = await db.query<{ id_subject: number; name_subject: string; avg_score: number }>(
    `SELECT 
        s.id_subject,
        s.name_subject,
        COALESCE(AVG(st.score), 0) as avg_score
     FROM subject s
     LEFT JOIN topic t ON t.id_subject = s.id_subject
     LEFT JOIN student_topic st ON st.id_topic = t.id_topic AND st.id_user = ?
     GROUP BY s.id_subject, s.name_subject
     HAVING avg_score > 0
     ORDER BY s.name_subject`,
    [userId]
  );

  return result.rows.map(row => ({
    subject_id: row.id_subject,
    subject_name: row.name_subject,
    score: Math.round(row.avg_score),
    color: SUBJECT_COLORS[row.name_subject] || SUBJECT_COLORS['default'],
  }));
}

export async function listStudentSections(userId: number) {
  const result = await db.query<{ id_section: number }>(
    `SELECT id_section FROM user_section WHERE id_user = ?`,
    [userId]
  );
  return result.rows.map(r => r.id_section);
}

export async function getStudentTopicMastery(userId: number, topicId: number) {
  const result = await db.query<{ score: number | null; ai_summary: string | null }>(
    `SELECT score, ai_summary 
     FROM student_topic 
     WHERE id_user = ? AND id_topic = ?`,
    [userId, topicId]
  );
  return result.rows[0] || { score: 0, ai_summary: null };
}

export async function getTopicSessionHistory(userId: number, topicId: number) {
  const result = await db.query<{
    id_class: number;
    class_name: string;
    score: number;
    date: string;
  }>(
    `SELECT cst.id_class, c.name_session as class_name, cst.score, c.start_time as date
     FROM class_student_topic cst
     INNER JOIN class c ON c.id_class = cst.id_class
     WHERE cst.id_user = ? AND cst.id_topic = ?
     ORDER BY c.start_time DESC`,
    [userId, topicId]
  );
  return result.rows;
}

export async function getHistoricalRecordsForTopic(userId: number, topicId: number) {
  // Aggregate data from multiple sources for AI analysis
  const [sessions, quizzes] = await Promise.all([
    // 1. Session performance and summaries
    db.query<{ class_name: string; score: number; ai_summary: string }>(
      `SELECT c.name_session as class_name, cst.score, scs.summary_text as ai_summary
       FROM class_student_topic cst
       INNER JOIN class c ON c.id_class = cst.id_class
       LEFT JOIN student_class_summary scs ON scs.id_class = c.id_class AND scs.id_user = cst.id_user
       WHERE cst.id_user = ? AND cst.id_topic = ?
       ORDER BY c.start_time DESC`,
      [userId, topicId]
    ),
    // 2. Quiz attempts and results for this topic
    db.query<{ quiz_name: string; score: number; finished_at: string }>(
      `SELECT q.name as quiz_name, qa.total_score as score, qa.finished_at
       FROM quiz_attempt qa
       INNER JOIN quiz q ON q.id_quiz = qa.id_quiz
       INNER JOIN quiz_topic qt ON qt.id_quiz = q.id_quiz
       WHERE qa.id_student = ? AND qt.id_topic = ? AND qa.finished_at IS NOT NULL
       ORDER BY qa.finished_at DESC`,
      [userId, topicId]
    )
  ]);

  return {
    sessions: sessions.rows,
    quizzes: quizzes.rows
  };
}

export async function updatePermanentTopicSummary(userId: number, topicId: number, summary: string) {
  await db.query(
    `UPDATE student_topic 
     SET ai_summary = ?, last_analysis_at = CURRENT_TIMESTAMP
     WHERE id_user = ? AND id_topic = ?`,
    [summary, userId, topicId]
  );
}

/**
 * Syncs a new session score into the permanent student_topic table.
 * Uses "Base-Score Anchoring" to ensure adaptive stability.
 * No matter how many quizzes are done in one session, the total daily contribution 
 * is capped at 20% of the final mastery (80/20 split).
 */
export async function syncStudentTopicMastery(userId: number, topicId: number, sessionScore: number, classId: number) {
  // 1. If it's a new session, update the base anchor
  await db.query(
    `UPDATE student_topic 
     SET base_score_session = score, 
         last_class_id = ?
     WHERE id_user = ? AND id_topic = ? AND (last_class_id IS NULL OR last_class_id != ?)`,
    [classId, userId, topicId, classId]
  );

  // 2. Perform the adaptive update
  // If base_score_session is NULL (first time), it will use the raw sessionScore
  // Formula: 80% Historical Anchor + 20% Current Session Average
  await db.query(
    `INSERT INTO student_topic (id_user, id_topic, score, base_score_session, last_class_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       score = (COALESCE(base_score_session, score) * 0.8) + (VALUES(score) * 0.2)`,
    [userId, topicId, sessionScore, sessionScore, classId]
  );
}


