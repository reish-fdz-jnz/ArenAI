import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { ClassTemplate, ClassTemplateTopic } from '../types.js';

export async function listTemplatesByProfessor(professorId: number) {
  const result = await db.query<ClassTemplate>(
    `SELECT id_class_template, id_professor, id_subject, name_template, grade, description, settings, created_at
     FROM class_template
     WHERE id_professor = ?
     ORDER BY created_at DESC`,
    [professorId]
  );
  return result.rows;
}

export async function getTemplateById(templateId: number) {
  const result = await db.query<ClassTemplate>(
    `SELECT id_class_template, id_professor, id_subject, name_template, grade, description, settings, created_at
     FROM class_template
     WHERE id_class_template = ?`,
    [templateId]
  );
  return result.rows[0];
}

export async function createTemplate(payload: {
  professorId: number;
  subjectId: number;
  name: string;
  grade: string;
  description?: string | null;
  settings?: any;
  topicIds: number[];
}) {
  const client = await db.getClient();
  try {
    await client.beginTransaction();

    const [insertResult] = await client.query<ResultSetHeader>(
      `INSERT INTO class_template (id_professor, id_subject, name_template, grade, description, settings)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.professorId,
        payload.subjectId,
        payload.name,
        payload.grade,
        payload.description ?? null,
        payload.settings ? JSON.stringify(payload.settings) : null
      ]
    );

    const templateId = insertResult.insertId;

    if (payload.topicIds.length > 0) {
      const values = payload.topicIds.map(id => [templateId, id]);
      await client.query(
        `INSERT INTO class_template_topic (id_class_template, id_topic)
         VALUES ?`,
        [values]
      );
    }

    await client.commit();
    return templateId;
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteTemplate(templateId: number, professorId: number) {
  const result = await db.query<ResultSetHeader>(
    `DELETE FROM class_template 
     WHERE id_class_template = ? AND id_professor = ?`,
    [templateId, professorId]
  );
  return result.rows[0].affectedRows > 0;
}

export async function listTopicsByTemplate(templateId: number) {
  const result = await db.query<{ id_topic: number; name: string }>(
    `SELECT t.id_topic, t.name
     FROM topic t
     INNER JOIN class_template_topic ctt ON ctt.id_topic = t.id_topic
     WHERE ctt.id_class_template = ?`,
    [templateId]
  );
  return result.rows;
}
