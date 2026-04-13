import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { ClassRecord } from '../types.js';
import { parseNumeric } from '../utils/transformers.js';

interface ClassTopicPayload {
  topicId: number;
  scoreAverage?: number | null;
  aiSummary?: string | null;
}

interface ClassStudentPayload {
  userId: number;
  scoreAverage?: number | null;
  aiSummary?: string | null;
  attendance?: boolean | null;
}

interface ClassStudentTopicPayload {
  userId: number;
  topicId: number;
  score?: number | null;
  aiSummary?: string | null;
}

export async function listClasses(filters: { professorId?: number; sectionId?: number; status?: string }) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.professorId) {
    conditions.push('c.id_professor = ?');
    params.push(filters.professorId);
  }

  if (filters.sectionId) {
    conditions.push('c.id_section = ?');
    params.push(filters.sectionId);
  }

  if (filters.status) {
    conditions.push('c.status = ?');
    params.push(filters.status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query<any>(
    `SELECT
        c.id_class,
        c.id_class_template,
        c.id_professor,
        c.id_section,
        c.id_institution,
        c.start_time,
        c.end_time,
        c.score_average,
        c.ai_summary,
        c.status,
        ct.name_template,
        sec.section_number AS section_name,
        sec.grade AS section_grade
     FROM class c
     LEFT JOIN class_template ct ON ct.id_class_template = c.id_class_template
     INNER JOIN section sec ON sec.id_section = c.id_section
     ${whereClause}
     ORDER BY c.start_time DESC`,
    params
  );

  return result.rows;
}

export async function createClass(payload: {
  templateId?: number | null;
  sectionId: number;
  professorId: number;
  institutionId?: number | null;
  status?: string;
}) {
  const insertResult = await db.query<ResultSetHeader>(
    `INSERT INTO class (id_class_template, id_section, id_professor, id_institution, status)
     VALUES (?, ?, ?, ?, ?)`,
    [
      payload.templateId ?? null,
      payload.sectionId,
      payload.professorId,
      payload.institutionId ?? null,
      payload.status ?? 'scheduled'
    ]
  );

  const created = await db.query<ClassRecord>(
    `SELECT id_class, id_class_template, id_professor, id_section, id_institution, start_time, end_time, score_average, ai_summary, status
     FROM class
     WHERE id_class = ?`,
    [insertResult.rows[0].insertId]
  );

  return created.rows[0];
}

export async function updateClassStatus(classId: number, status: string, endTime?: string | null) {
  const query = endTime 
    ? `UPDATE class SET status = ?, end_time = ? WHERE id_class = ?`
    : `UPDATE class SET status = ? WHERE id_class = ?`;
  
  const params = endTime ? [status, endTime, classId] : [status, classId];
  
  await db.query(query, params);
}

export async function updateClassSummary(classId: number, summary: string, scoreAverage?: number) {
  const fields = ['ai_summary = ?'];
  const params = [summary];

  if (scoreAverage !== undefined) {
    fields.push('score_average = ?');
    params.push(scoreAverage);
  }

  params.push(classId);

  await db.query(
    `UPDATE class SET ${fields.join(', ')} WHERE id_class = ?`,
    params
  );
}

export async function recordClassTopics(classId: number, topics: ClassTopicPayload[]) {
  if (!topics.length) return;
  const client = await db.getClient();
  try {
    await client.beginTransaction();
    for (const topic of topics) {
      await client.query(
        `INSERT INTO class_topic (id_class, id_topic, score_average, ai_summary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score_average = VALUES(score_average),
           ai_summary = VALUES(ai_summary)`,
        [classId, topic.topicId, topic.scoreAverage ?? 0, topic.aiSummary ?? null]
      );
    }
    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

export async function recordClassStudents(classId: number, students: ClassStudentPayload[]) {
  if (!students.length) return;
  const client = await db.getClient();
  try {
    await client.beginTransaction();
    for (const student of students) {
      await client.query(
        `INSERT INTO class_student (id_class, id_user, score_average, ai_summary, attendance)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score_average = VALUES(score_average),
           ai_summary = VALUES(ai_summary),
           attendance = VALUES(attendance)`,
        [classId, student.userId, student.scoreAverage ?? 0, student.aiSummary ?? null, student.attendance ?? true]
      );
    }
    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

export async function recordClassStudentTopics(classId: number, entries: ClassStudentTopicPayload[]) {
  if (!entries.length) return;
  const client = await db.getClient();
  try {
    await client.beginTransaction();
    for (const entry of entries) {
      await client.query(
        `INSERT INTO class_student_topic (id_class, id_user, id_topic, score, ai_summary)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score = VALUES(score),
           ai_summary = VALUES(ai_summary)`,
        [classId, entry.userId, entry.topicId, entry.score ?? 0, entry.aiSummary ?? null]
      );
    }
    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}
