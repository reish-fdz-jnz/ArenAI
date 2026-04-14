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

export async function getStudentStats(userId: number): Promise<StudentStats> {
  // Get quiz stats
  const quizResult = await db.query<{ quiz_count: number; avg_score: number }>(
    `SELECT 
        COUNT(*) as quiz_count,
        COALESCE(AVG(score), 0) as avg_score
     FROM quiz_student
     WHERE id_student = ?`,
    [userId]
  );

  // Get battle stats
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

  // Get class rank (based on quiz average)
  const rankResult = await db.query<{ rank: number }>(
    `SELECT COUNT(*) + 1 as rank
     FROM (
       SELECT id_student, AVG(score) as avg_score
       FROM quiz_student
       WHERE score IS NOT NULL
       GROUP BY id_student
     ) scores
     WHERE avg_score > (
       SELECT COALESCE(AVG(score), 0)
       FROM quiz_student
       WHERE id_student = ?
     )`,
    [userId]
  );

  const quizStats = quizResult.rows[0] || { quiz_count: 0, avg_score: 0 };
  const battleStats = battleResult.rows[0] || { wins: 0, total: 0 };
  const rank = rankResult.rows[0]?.rank || null;

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

