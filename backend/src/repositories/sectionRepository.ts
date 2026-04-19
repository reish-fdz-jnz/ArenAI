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
  const params: any[] = [sectionId, sectionId, subjectName];
  let filterClause = '';
  
  if (classId) {
    filterClause = 'AND ct.id_class = ?';
    params.push(classId);
  }

  const result = await db.query<any>(
    `SELECT 
        t.id_topic, 
        t.name as name_topic, 
        COALESCE(st.score, AVG(ct.score_average)) as score, 
        COALESCE(st.ai_summary, MAX(ct.ai_summary)) as ai_summary
     FROM topic t
     LEFT JOIN section_topic st ON st.id_topic = t.id_topic AND st.id_section = ?
     LEFT JOIN class_topic ct ON ct.id_topic = t.id_topic
     LEFT JOIN class c ON c.id_class = ct.id_class AND c.id_section = ?
     INNER JOIN subject sub ON sub.id_subject = t.id_subject
     WHERE sub.name_subject = ? ${filterClause}
     GROUP BY t.id_topic, t.name, st.score, st.ai_summary
     ORDER BY t.name`,
    params
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
