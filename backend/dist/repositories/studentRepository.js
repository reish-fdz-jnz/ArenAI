import { db } from '../db/pool.js';
export async function getStudentTopicProgress(userId) {
    const result = await db.query(`SELECT
        st.id_topic,
        t.name AS topic_name,
        s.name_subject AS subject_name,
        st.score
     FROM student_topic st
     INNER JOIN topic t ON t.id_topic = st.id_topic
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE st.id_user = ?
     ORDER BY s.name_subject, t.name`, [userId]);
    return result.rows;
}
export async function upsertStudentTopicScore(payload) {
    await db.query(`INSERT INTO student_topic (id_user, id_topic, score)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score)`, [payload.userId, payload.topicId, payload.score]);
    const result = await db.query(`SELECT
        st.id_topic,
        t.name AS topic_name,
        s.name_subject AS subject_name,
        st.score
     FROM student_topic st
     INNER JOIN topic t ON t.id_topic = st.id_topic
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE st.id_user = ? AND st.id_topic = ?`, [payload.userId, payload.topicId]);
    return result.rows[0];
}
export async function listStudentsBySection(sectionId, institutionId) {
    const conditions = ['us.id_section = ?'];
    const params = [sectionId];
    if (institutionId) {
        conditions.push('u.id_institution = ?');
        params.push(institutionId);
    }
    const result = await db.query(`SELECT
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
     ORDER BY u.name, u.last_name, u.username`, params);
    return result.rows;
}
export async function getStudentStats(userId) {
    // Get quiz stats
    const quizResult = await db.query(`SELECT 
        COUNT(*) as quiz_count,
        COALESCE(AVG(score), 0) as avg_score
     FROM quiz_student
     WHERE id_student = ?`, [userId]);
    // Get battle stats
    const battleResult = await db.query(`SELECT 
        SUM(CASE 
          WHEN (id_user_1 = ? AND winner = 1) OR (id_user_2 = ? AND winner = 0) 
          THEN 1 ELSE 0 
        END) as wins,
        COUNT(*) as total
     FROM battle_minigame
     WHERE id_user_1 = ? OR id_user_2 = ?`, [userId, userId, userId, userId]);
    // Get class rank (based on quiz average)
    const rankResult = await db.query(`SELECT COUNT(*) + 1 as rank
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
     )`, [userId]);
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
const SUBJECT_COLORS = {
    'Math': '#3b82f6',
    'Science': '#10b981',
    'Social Studies': '#f59e0b',
    'Spanish': '#ec4899',
    'default': '#667eea',
};
export async function getStudentSubjectScores(userId) {
    const result = await db.query(`SELECT 
        s.id_subject,
        s.name_subject,
        COALESCE(AVG(st.score), 0) as avg_score
     FROM subject s
     LEFT JOIN topic t ON t.id_subject = s.id_subject
     LEFT JOIN student_topic st ON st.id_topic = t.id_topic AND st.id_user = ?
     GROUP BY s.id_subject, s.name_subject
     HAVING avg_score > 0
     ORDER BY s.name_subject`, [userId]);
    return result.rows.map(row => ({
        subject_id: row.id_subject,
        subject_name: row.name_subject,
        score: Math.round(row.avg_score),
        color: SUBJECT_COLORS[row.name_subject] || SUBJECT_COLORS['default'],
    }));
}
export async function listStudentSections(userId) {
    const result = await db.query(`SELECT id_section FROM user_section WHERE id_user = ?`, [userId]);
    return result.rows.map(r => r.id_section);
}
