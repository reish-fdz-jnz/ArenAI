import { db } from '../db/pool.js';
export async function listSectionsByInstitution(institutionId) {
    const result = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_institution = ?
     ORDER BY grade, section_number`, [institutionId]);
    return result.rows;
}
// List all sections (fallback when user has no institution)
export async function listAllSections() {
    const result = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     ORDER BY grade, section_number
     LIMIT 100`);
    return result.rows;
}
export async function getSectionById(sectionId) {
    const result = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_section = ?
     LIMIT 1`, [sectionId]);
    return result.rows.at(0) ?? null;
}
export async function createSection(payload) {
    const insertResult = await db.query(`INSERT INTO section (section_number, grade, id_institution)
     VALUES (?, ?, ?)`, [payload.sectionNumber, payload.grade, payload.institutionId]);
    const newSection = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE id_section = ?`, [insertResult.rows[0].insertId]);
    return newSection.rows[0];
}
export async function findSectionByNumberAndInstitution(sectionNumber, institutionId) {
    const result = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE section_number = ? AND id_institution = ?
     LIMIT 1`, [sectionNumber, institutionId]);
    return result.rows.at(0) ?? null;
}
export async function findSectionByGradeAndNumber(grade, sectionNumber, institutionId) {
    const result = await db.query(`SELECT id_section, section_number, grade, id_institution
     FROM section
     WHERE grade = ? AND section_number = ? AND id_institution = ?
     LIMIT 1`, [grade, sectionNumber, institutionId]);
    return result.rows.at(0) ?? null;
}
export async function getSectionTopicProgress(sectionId, subjectName) {
    const result = await db.query(`SELECT 
        ct.id_topic, 
        t.name as name_topic, 
        AVG(ct.score_average) as score, 
        MAX(ct.ai_summary) as ai_summary,
        t.icon
     FROM class c
     INNER JOIN class_topic ct ON ct.id_class = c.id_class
     INNER JOIN topic t ON t.id_topic = ct.id_topic
     INNER JOIN subject sub ON sub.id_subject = t.id_subject
     WHERE c.id_section = ? AND sub.name_subject = ?
     GROUP BY ct.id_topic, t.name, t.icon
     ORDER BY t.name`, [sectionId, subjectName]);
    return result.rows;
}
export async function getSectionTopicMastery(sectionId, topicId) {
    const result = await db.query(`SELECT 
        AVG(ct.score_average) as score, 
        MAX(ct.ai_summary) as ai_summary 
     FROM class c
     INNER JOIN class_topic ct ON ct.id_class = c.id_class
     WHERE c.id_section = ? AND ct.id_topic = ?`, [sectionId, topicId]);
    return result.rows[0] || { score: 0, ai_summary: null };
}
export async function getSectionTopicHistory(sectionId, topicId) {
    const result = await db.query(`SELECT ct.id_class, c.name_session as class_name, ct.score_average as score, c.start_time as date
     FROM class_topic ct
     INNER JOIN class c ON c.id_class = ct.id_class
     WHERE c.id_section = ? AND ct.id_topic = ?
     ORDER BY c.start_time DESC`, [sectionId, topicId]);
    return result.rows;
}
