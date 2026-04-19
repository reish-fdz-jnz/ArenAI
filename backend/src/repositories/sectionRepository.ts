import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { Section } from '../types.js';

export async function listSectionsByInstitution(institutionId: number) {
  const result = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_institution = ?
     ORDER BY grade, section_number`,
    [institutionId]
  );

  return result.rows;
}

// List all sections (fallback when user has no institution)
export async function listAllSections() {
  const result = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     ORDER BY grade, section_number
     LIMIT 100`
  );

  return result.rows;
}

export async function getSectionById(sectionId: number) {
  const result = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_section = ?
     LIMIT 1`,
    [sectionId]
  );

  return result.rows.at(0) ?? null;
}

export async function createSection(payload: { sectionNumber: string; grade: string; institutionId: number }) {
  const insertResult = await db.query<ResultSetHeader>(
    `INSERT INTO section (section_number, grade, id_institution)
     VALUES (?, ?, ?)`,
    [payload.sectionNumber, payload.grade, payload.institutionId]
  );

  const newSection = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_section = ?`,
    [insertResult.rows[0].insertId]
  );

  return newSection.rows[0];
}

export async function findSectionByNumberAndInstitution(sectionNumber: string, institutionId: number) {
  const result = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE section_number = ? AND id_institution = ?
     LIMIT 1`,
    [sectionNumber, institutionId]
  );
  return result.rows.at(0) ?? null;
}

export async function findSectionByGradeAndNumber(grade: string, sectionNumber: string, institutionId: number) {
  const result = await db.query<Section>(
    `SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE grade = ? AND section_number = ? AND id_institution = ?
     LIMIT 1`,
    [grade, sectionNumber, institutionId]
  );
  return result.rows.at(0) ?? null;
}

export async function getSectionTopicProgress(sectionId: number, subjectName: string, classId?: number) {
  if (classId) {
    // Session Mode: Show ONLY topics assigned to this class
    // Mastery shown is the average score of all students in the section for these topics
    // Returns NULL if no students have scores yet (to show gray 'unstarted' state)
    const result = await db.query<any>(
      `SELECT 
          t.id_topic, 
          t.name as name_topic, 
          COALESCE(sect.score, agg.avg_score) as score,
          sect.ai_summary
       FROM class_topic ct
       INNER JOIN topic t ON t.id_topic = ct.id_topic
       INNER JOIN class c ON c.id_class = ct.id_class
       -- Force link to the active section's permanent records
       LEFT JOIN section_topic sect ON sect.id_section = ? AND sect.id_topic = ct.id_topic
       -- Fallback: aggregate average from ALL classes of this specific section
       LEFT JOIN (
         SELECT ct2.id_topic, AVG(ct2.score_average) as avg_score
         FROM class c2
         INNER JOIN class_topic ct2 ON ct2.id_class = c2.id_class
         WHERE c2.id_section = ?
         GROUP BY ct2.id_topic
       ) agg ON agg.id_topic = ct.id_topic
       WHERE ct.id_class = ?
       ORDER BY t.name`,
      [sectionId, sectionId, classId]
    );
    return result.rows;
  } else {
    // Global/Idle Mode: Show all topics in the subject
    const result = await db.query<any>(
      `SELECT 
          t.id_topic, 
          t.name as name_topic, 
          COALESCE(st.score, 0) as score,
          st.ai_summary
       FROM topic t
       INNER JOIN subject sub ON sub.id_subject = t.id_subject
       LEFT JOIN section_topic st ON st.id_topic = t.id_topic AND st.id_section = ?
       WHERE sub.name_subject = ?
       ORDER BY t.name`,
      [sectionId, subjectName]
    );
    return result.rows;
  }
}

// ============================================================
// Section Topic functions
// ============================================================

/**
 * Get all topics for a section with their scores and AI summaries
 */
export async function getSectionTopics(sectionId: number) {
  const result = await db.query<{
    id_section_topic: number;
    id_section: number;
    id_topic: number;
    topic_name: string;
    id_subject: number;
    subject_name: string;
    score: number | null;
    ai_summary: string | null;
    base_score_session: number | null;
    last_class_id: number | null;
    last_analysis_at: string | null;
  }>(
    `SELECT st.id_section_topic, st.id_section, st.id_topic,
            t.name as topic_name, t.id_subject,
            s.name_subject as subject_name,
            st.score, st.ai_summary, st.base_score_session,
            st.last_class_id, st.last_analysis_at
     FROM section_topic st
     INNER JOIN topic t ON t.id_topic = st.id_topic
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE st.id_section = ?
     ORDER BY t.id_subject, t.name`,
    [sectionId]
  );
  return result.rows;
}

export async function getSectionTopicMastery(sectionId: number, topicId: number) {
  try {
    const result = await db.query<{ score: number | null; ai_summary: string | null }>(
      `SELECT score, ai_summary 
       FROM section_topic 
       WHERE id_section = ? AND id_topic = ?`,
      [sectionId, topicId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
  } catch (err: any) {
    // If the table doesn't exist yet (migration not run), log and fallback
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    console.warn("[sectionRepository] section_topic table missing, falling back to aggregate query.");
  }

  // Fallback to on-the-fly average
  const fallback = await db.query<{ score: number | null; ai_summary: string | null }>(
    `SELECT 
        AVG(ct.score_average) as score, 
        MAX(ct.ai_summary) as ai_summary 
     FROM class c
     INNER JOIN class_topic ct ON ct.id_class = c.id_class
     WHERE c.id_section = ? AND ct.id_topic = ?`,
    [sectionId, topicId]
  );
  return fallback.rows[0] || { score: 0, ai_summary: null };
}

/**
 * Syncs a new session score into the permanent section_topic table.
 * Mirrors the student adaptive anchoring logic.
 */
export async function syncSectionTopicMastery(sectionId: number, topicId: number, sessionScore: number, classId: number) {
  try {
    // 1. Update anchor if it's a new class session being synced
    await db.query(
      `UPDATE section_topic 
       SET base_score_session = score, 
           last_class_id = ?
       WHERE id_section = ? AND id_topic = ? AND (last_class_id IS NULL OR last_class_id != ?)`,
      [classId, sectionId, topicId, classId]
    );

    // 2. Perform the adaptive update (80/20 split)
    await db.query(
      `INSERT INTO section_topic (id_section, id_topic, score, base_score_session, last_class_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         score = (COALESCE(base_score_session, score) * 0.8) + (VALUES(score) * 0.2)`,
      [sectionId, topicId, sessionScore, sessionScore, classId]
    );
  } catch (err: any) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.error("[sectionRepository] Cannot sync mastery: section_topic table MISSING. Run migrations!");
      return;
    }
    throw err;
  }
}

export async function getSectionTopicHistory(sectionId: number, topicId: number) {
  const result = await db.query<{
    id_class: number;
    class_name: string;
    score: number;
    date: string;
  }>(
    `SELECT ct.id_class, c.name_session as class_name, ct.score_average as score, c.start_time as date
     FROM class_topic ct
     INNER JOIN class c ON c.id_class = ct.id_class
     WHERE c.id_section = ? AND ct.id_topic = ?
     ORDER BY c.start_time DESC`,
    [sectionId, topicId]
  );
  return result.rows;
}

/**
 * Update the AI summary for a section topic
 */
export async function updateSectionTopicSummary(sectionId: number, topicId: number, summary: string) {
  await db.query(
    `UPDATE section_topic 
     SET ai_summary = ?, last_analysis_at = CURRENT_TIMESTAMP
     WHERE id_section = ? AND id_topic = ?`,
    [summary, sectionId, topicId]
  );
}

/**
 * Get student user IDs for a given section
 */
export async function getStudentIdsForSection(sectionId: number): Promise<number[]> {
  const result = await db.query<{ id_user: number }>(
    `SELECT us.id_user 
     FROM user_section us
     INNER JOIN student_profile sp ON sp.id_user = us.id_user
     WHERE us.id_section = ?`,
    [sectionId]
  );
  return result.rows.map(r => r.id_user);
}

/**
 * Upsert a section topic record (create if not exists)
 */
export async function upsertSectionTopic(sectionId: number, topicId: number, score?: number | null) {
  await db.query(
    `INSERT INTO section_topic (id_section, id_topic, score)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       score = COALESCE(VALUES(score), score)`,
    [sectionId, topicId, score ?? null]
  );
}