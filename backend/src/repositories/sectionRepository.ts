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

