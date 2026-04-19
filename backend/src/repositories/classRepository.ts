import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { ClassRecord } from '../types.js';
import { parseNumeric } from '../utils/transformers.js';
import { syncStudentTopicMastery } from './studentRepository.js';
import { syncSectionTopicMastery } from './sectionRepository.js';
import { io } from '../server.js';

interface ClassTopicPayload {
  topicId: number;
  scoreAverage?: number | null;
  aiSummary?: string | null;
}

interface ClassStudentPayload {
  userId: number;
  scoreAverage?: number | null;
  aiSummary?: string | null;
  attendance?: number | boolean | null;
}

interface ClassStudentTopicPayload {
  userId: number;
  topicId: number;
  score?: number | null;
  aiSummary?: string | null;
}

export async function listClasses(filters: { professorId?: number; sectionId?: number; status?: string; startDate?: string; endDate?: string }) {
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

  if (filters.startDate && filters.endDate) {
    conditions.push('c.start_time BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query<any>(
    `SELECT
        c.id_class,
        c.name_session,
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

export async function getClassById(classId: number): Promise<ClassRecord | null> {
  const result = await db.query<ClassRecord>(
    `SELECT * FROM class WHERE id_class = ?`,
    [classId]
  );
  return result.rows.length ? result.rows[0] : null;
}


export async function createClass(payload: {
  name_session?: string | null;
  templateId?: number | null;
  sectionId: number;
  professorId: number;
  institutionId?: number | null;
  status?: string;
}) {
  const client = await db.getClient();
  try {
    await client.beginTransaction();

    let sessionName = payload.name_session;
    let templateTopicIds: number[] = [];

    // 1. If template is provided, fetch topics and name
    if (payload.templateId) {
      const templateRes = await client.query<{ name_template: string }>(
        `SELECT name_template FROM class_template WHERE id_class_template = ?`,
        [payload.templateId]
      );
      
      if (templateRes.rows.length > 0) {
        if (!sessionName) sessionName = templateRes.rows[0].name_template;
      }

      const topicsRes = await client.query<{ id_topic: number }>(
        `SELECT id_topic FROM class_template_topic WHERE id_class_template = ?`,
        [payload.templateId]
      );
      templateTopicIds = topicsRes.rows.map(r => r.id_topic);
    }

    // 2. Create the class
    const insertResult = await client.query<ResultSetHeader>(
      `INSERT INTO class (name_session, id_class_template, id_section, id_professor, id_institution, status, score_average, start_time)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NOW())`,
      [
        sessionName ?? 'New Session',
        payload.templateId ?? null,
        payload.sectionId,
        payload.professorId,
        payload.institutionId ?? null,
        payload.status ?? 'scheduled'
      ]
    );

    const classId = insertResult.rows[0].insertId;

    // 3. Populate class_topic from template topics
    for (const topicId of templateTopicIds) {
      await client.query(
        `INSERT INTO class_topic (id_class, id_topic, score_average)
         VALUES (?, ?, 0)`,
        [classId, topicId]
      );
    }

    // 4. Fetch and return the full class record
    const classRows = await client.query<ClassRecord>(
      `SELECT id_class, name_session, id_class_template, id_professor, id_section, id_institution, start_time, end_time, score_average, ai_summary, status 
       FROM class 
       WHERE id_class = ?`,
      [classId]
    );

    await client.commit();
    return classRows.rows[0];

  } catch (error) {
    await client.rollback();
    console.error('Error in createClass:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateClassStatus(classId: number, status: string, setEndTime: boolean = false) {
  let query = `UPDATE class SET status = ?`;
  const params: any[] = [status];

  if (setEndTime) {
    query += `, end_time = NOW()`;
  }

  query += ` WHERE id_class = ?`;
  params.push(classId);

  await db.query(query, params);
}

export async function updateClassName(classId: number, name: string) {
  await db.query(
    `UPDATE class SET name_session = ? WHERE id_class = ?`,
    [name, classId]
  );
}

export async function updateClassSummary(classId: number, summary: string, scoreAverage?: number) {
  const fields = ['ai_summary = ?'];
  const params: any[] = [summary];

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
    
    // Get class info for section anchoring
    const { rows: classRows } = await client.query<{id_section: number}>(
      'SELECT id_section FROM class WHERE id_class = ?', [classId]
    );
    const sectionId = classRows[0]?.id_section;

    for (const topic of topics) {
      // 1. SMART AVERAGING for Class Topics
      await client.query(
        `INSERT INTO class_topic (id_class, id_topic, score_average, ai_summary, attempts_count)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           score_average = (score_average * attempts_count + VALUES(score_average)) / (attempts_count + 1),
           attempts_count = attempts_count + 1,
           ai_summary = VALUES(ai_summary)`,
        [classId, topic.topicId, topic.scoreAverage ?? null, topic.aiSummary ?? null]
      );

      // 2. CALCULATE & STORE Real-Time SECTION Snapshot
      if (sectionId && topic.scoreAverage !== null) {
        const { rows: avgRows } = await client.query<{running_avg: number}>(
          `SELECT AVG(ct.score_average) as running_avg
           FROM class_topic ct
           INNER JOIN class c ON c.id_class = ct.id_class
           WHERE c.id_section = ? AND ct.id_topic = ?`,
          [sectionId, topic.topicId]
        );

        const currentSectionMastery = Number(avgRows[0]?.running_avg || topic.scoreAverage || 0);

        // Update the snapshot for the active class_topic record
        await client.query(
          `UPDATE class_topic 
           SET section_mastery_snapshot = ? 
           WHERE id_class = ? AND id_topic = ?`,
          [currentSectionMastery, classId, topic.topicId]
        );

        // 4. Update permanent SECTION Mastery
        await syncSectionTopicMastery(sectionId, topic.topicId, topic.scoreAverage || 0, classId);

        // 5. BROADCAST Live Section Update
        io.to(`section_${sectionId}`).emit('class_score_update', {
          classId,
          topicId: topic.topicId,
          scoreAverage: topic.scoreAverage,
          sectionMastery: currentSectionMastery // Send the aggregated number for the dashboard
        });
      }
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
      // Use averaging for the overall session score if it's updated multiple times
      await client.query(
        `INSERT INTO class_student (id_class, id_user, score_average, ai_summary, attendance)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score_average = (COALESCE(score_average, VALUES(score_average)) + VALUES(score_average)) / 2,
           ai_summary = VALUES(ai_summary),
           attendance = VALUES(attendance)`,
        [classId, student.userId, student.scoreAverage ?? null, student.aiSummary ?? null, student.attendance ?? null]
      );

      // BROADCAST Live Update to specific student room
      io.to(`user_${student.userId}`).emit('student_score_update', {
        classId,
        overallAverage: student.scoreAverage
      });
    }
    await client.commit();
    
    // Trigger roll-up to class/section mastery
    recalculateClassAverages(classId).catch(err => console.error("Roll-up error:", err));
    
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

// Updates ONLY the score_average for a student in a class.
// Attendance is teacher-managed and must NOT be touched here.
export async function updateClassStudentScore(classId: number, userId: number, scorePercentage: number) {
  await db.query(
    `INSERT INTO class_student (id_class, id_user, score_average)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       score_average = (COALESCE(score_average, VALUES(score_average)) + VALUES(score_average)) / 2`,
    [classId, userId, scorePercentage]
  );
  
  // BROADCAST
  io.to(`user_${userId}`).emit('student_score_update', {
    classId,
    overallAverage: scorePercentage
  });

  // Trigger roll-up
  recalculateClassAverages(classId).catch(err => console.error("Roll-up error:", err));
}

export async function recordClassStudentTopics(classId: number, entries: ClassStudentTopicPayload[]) {
  if (!entries.length) return;
  const client = await db.getClient();
  try {
    await client.beginTransaction();
    for (const entry of entries) {
      // SMART AVERAGING: Uses attempts_count to ensure a true mathematical average
      await client.query(
        `INSERT INTO class_student_topic (id_class, id_user, id_topic, score, ai_summary, attempts_count)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           score = (score * attempts_count + VALUES(score)) / (attempts_count + 1),
           attempts_count = attempts_count + 1,
           ai_summary = VALUES(ai_summary)`,
        [classId, entry.userId, entry.topicId, entry.score ?? null, entry.aiSummary ?? null]
      );

      // Propagate to permanent mastery using adaptive anchoring
      if (entry.score !== null && entry.score !== undefined) {
        // Fetch the CURRENT daily average after the update we just did
        const { rows } = await client.query<{score: number}>(
          `SELECT score FROM class_student_topic WHERE id_class = ? AND id_user = ? AND id_topic = ?`,
          [classId, entry.userId, entry.topicId]
        );
        
        if (rows.length > 0) {
          const latestScore = Number(rows[0].score);
          await syncStudentTopicMastery(entry.userId, entry.topicId, latestScore, classId);
          
          // BROADCAST Live Update to specific student room
          io.to(`user_${entry.userId}`).emit('student_topic_update', {
            topicId: entry.topicId,
            score: latestScore
          });
        }
      }
    }
    await client.commit();

    // Trigger roll-up
    recalculateClassAverages(classId).catch(err => console.error("Roll-up error:", err));

  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

export async function listAttendance(classId: number) {
  const result = await db.query<any>(
    `SELECT 
        u.id_user, 
        u.username, 
        u.email, 
        cs.attendance, 
        cs.score_average, 
        cs.ai_summary
     FROM class_student cs
     INNER JOIN user u ON u.id_user = cs.id_user
     WHERE cs.id_class = ?
     ORDER BY u.name, u.username`,
    [classId]
  );
  return result.rows;
}

export async function listClassesForStudent(studentId: number, filters?: { status?: string; startDate?: string; endDate?: string }) {
  const conditions: string[] = ['us.id_user = ?'];
  const params: any[] = [studentId];

  if (filters?.status) {
    conditions.push('c.status = ?');
    params.push(filters.status);
  }

  if (filters?.startDate && filters?.endDate) {
    conditions.push('c.start_time BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await db.query<any>(
    `SELECT
        c.id_class,
        c.name_session,
        c.id_class_template,
        c.id_professor,
        c.id_section,
        c.id_institution,
        c.start_time,
        c.end_time,
        c.score_average as class_score_average,
        c.ai_summary as class_ai_summary,
        c.status,
        ct.name_template,
        sec.section_number AS section_name,
        sec.grade AS section_grade,
        cs.attendance,
        cs.score_average as student_score_average,
        cs.ai_summary as student_ai_summary
     FROM class c
     INNER JOIN user_section us ON us.id_section = c.id_section
     LEFT JOIN class_template ct ON ct.id_class_template = c.id_class_template
     INNER JOIN section sec ON sec.id_section = c.id_section
     LEFT JOIN class_student cs ON cs.id_class = c.id_class AND cs.id_user = us.id_user
     ${whereClause}
     ORDER BY c.start_time DESC`,
    params
  );

  return result.rows;
}

export async function upsertStudentAttendance(classId: number, userId: number, attendance: number = 1) {
  try {
    await db.query(
      `INSERT INTO class_student (id_class, id_user, attendance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE attendance = VALUES(attendance)`,
      [classId, userId, attendance]
    );
  } catch (err: any) {
    console.error('Error auto-joining class:', err.message);
  }
}

export async function getStudentClassData(classId: number, userId: number) {
  const result = await db.query<any>(
    `SELECT attendance, score_average, ai_summary, interaction_coefficient
     FROM class_student
     WHERE id_class = ? AND id_user = ?`,
    [classId, userId]
  );
  return result.rows[0];
}

export async function getStudentClassTopics(classId: number, userId: number) {
  const result = await db.query<any>(
    `SELECT 
        cst.id_topic, 
        t.name as topic_name, 
        cst.score, 
        cst.ai_summary
     FROM class_student_topic cst
     INNER JOIN topic t ON t.id_topic = cst.id_topic
     WHERE cst.id_class = ? AND cst.id_user = ?`,
    [classId, userId]
  );
  return result.rows;
}

export async function findActiveClassForStudent(studentId: number): Promise<number | null> {
  // Finds a class that is 'running' and belongs to a section the student is enrolled in
  const result = await db.query<any>(
    `SELECT c.id_class 
     FROM class c
     INNER JOIN user_section us ON us.id_section = c.id_section
     WHERE us.id_user = ? AND c.status = 'running'
     ORDER BY c.start_time DESC
     LIMIT 1`,
    [studentId]
  );
  return result.rows[0]?.id_class || null;
}
export async function recalculateClassAverages(classId: number) {
  const client = await db.getClient();
  try {
    await client.beginTransaction();

    // 1. Recalculate Class Overall Average (ONLY students with attendance = 1)
    const overallRes = await client.query<{ avg: number | null }>(
      `SELECT AVG(score_average) as avg 
       FROM class_student 
       WHERE id_class = ? AND (attendance = 1 OR attendance = true) AND score_average IS NOT NULL`,
      [classId]
    );
    const newClassAvg = overallRes.rows[0]?.avg !== null ? Math.round(overallRes.rows[0].avg) : null;

    await client.query(
      `UPDATE class SET score_average = ? WHERE id_class = ?`,
      [newClassAvg, classId]
    );

    // 2. Recalculate each Topic Average for the class
    const topicsResult = await client.query<{ id_topic: number; avg_score: number }>(
      `SELECT cst.id_topic, AVG(cst.score) as avg_score
       FROM class_student_topic cst
       INNER JOIN class_student cs ON cs.id_class = cst.id_class AND cs.id_user = cst.id_user
       WHERE cst.id_class = ? AND (cs.attendance = 1 OR cs.attendance = true)
       GROUP BY cst.id_topic`,
      [classId]
    );

    // Get sectionId for syncing mastery
    const classInfo = await client.query<{ id_section: number }>(
      `SELECT id_section FROM class WHERE id_class = ?`,
      [classId]
    );
    const sectionId = classInfo.rows[0]?.id_section;

    for (const topic of topicsResult.rows) {
      // Update class_topic table (roll-up log for today)
      await client.query(
        `INSERT INTO class_topic (id_class, id_topic, score_average)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score_average = VALUES(score_average)`,
        [classId, topic.id_topic, topic.avg_score]
      );

      // 2. Real-time Mastery Calculation: Average of ALL students in the section
      let sectionAggregateScore = topic.avg_score; // Fallback
      if (sectionId) {
        const aggregateRes = await client.query<{ avg_score: number | null }>(
          `SELECT AVG(st.score) as avg_score
           FROM user_section us
           LEFT JOIN student_topic st ON st.id_user = us.id_user AND st.id_topic = ?
           WHERE us.id_section = ?`,
          [topic.id_topic, sectionId]
        );
        sectionAggregateScore = aggregateRes.rows[0]?.avg_score !== null ? aggregateRes.rows[0].avg_score : 0;

        // Keep section_topic synced for historical consistency
        await syncSectionTopicMastery(sectionId, topic.id_topic, topic.avg_score, classId);
      }

      // BROADCAST Updated Section Mastery to the Professor Dashboard
      if (sectionId) {
        io.to(`section_${sectionId}`).emit('class_score_update', {
          classId,
          topicId: topic.id_topic,
          sectionMastery: sectionAggregateScore // The baseline mean of your students
        });
      }
    }

    // BROADCAST Class Overall Update (STRICT SESSION AVG)
    if (sectionId) {
      io.to(`section_${sectionId}`).emit('class_overall_update', {
        classId,
        overallAverage: newClassAvg // Uses the session-only null/0 average
      });
    }

    await client.commit();
  } catch (err) {
    await client.rollback();
    console.error(`Error in recalculateClassAverages for class ${classId}:`, err);
  } finally {
    client.release();
  }
}
