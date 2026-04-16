import { db } from '../db/pool.js';
export async function listClasses(filters) {
    const conditions = [];
    const params = [];
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
    const result = await db.query(`SELECT
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
     ORDER BY c.start_time DESC`, params);
    return result.rows;
}
export async function getClassById(classId) {
    const result = await db.query(`SELECT * FROM class WHERE id_class = ?`, [classId]);
    return result.rows.length ? result.rows[0] : null;
}
export async function createClass(payload) {
    const insertResult = await db.query(`INSERT INTO class (name_session, id_class_template, id_section, id_professor, id_institution, status, start_time)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`, [
        payload.name_session ?? null,
        payload.templateId ?? null,
        payload.sectionId,
        payload.professorId,
        payload.institutionId ?? null,
        payload.status ?? 'scheduled'
    ]);
    const { rows } = await db.query(`SELECT id_class, name_session, id_class_template, id_professor, id_section, id_institution, start_time, end_time, score_average, ai_summary, status
     FROM class
     WHERE id_class = ?`, [insertResult.rows[0].insertId]);
    return rows[0];
}
export async function updateClassStatus(classId, status, setEndTime = false) {
    let query = `UPDATE class SET status = ?`;
    const params = [status];
    if (setEndTime) {
        query += `, end_time = NOW()`;
    }
    query += ` WHERE id_class = ?`;
    params.push(classId);
    await db.query(query, params);
}
export async function updateClassName(classId, name) {
    await db.query(`UPDATE class SET name_session = ? WHERE id_class = ?`, [name, classId]);
}
export async function updateClassSummary(classId, summary, scoreAverage) {
    const fields = ['ai_summary = ?'];
    const params = [summary];
    if (scoreAverage !== undefined) {
        fields.push('score_average = ?');
        params.push(scoreAverage);
    }
    params.push(classId);
    await db.query(`UPDATE class SET ${fields.join(', ')} WHERE id_class = ?`, params);
}
export async function recordClassTopics(classId, topics) {
    if (!topics.length)
        return;
    const client = await db.getClient();
    try {
        await client.beginTransaction();
        for (const topic of topics) {
            await client.query(`INSERT INTO class_topic (id_class, id_topic, score_average, ai_summary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score_average = VALUES(score_average),
           ai_summary = VALUES(ai_summary)`, [classId, topic.topicId, topic.scoreAverage ?? 0, topic.aiSummary ?? null]);
        }
        await client.commit();
    }
    catch (error) {
        await client.rollback();
        throw error;
    }
    finally {
        client.release();
    }
}
export async function recordClassStudents(classId, students) {
    if (!students.length)
        return;
    const client = await db.getClient();
    try {
        await client.beginTransaction();
        for (const student of students) {
            await client.query(`INSERT INTO class_student (id_class, id_user, score_average, ai_summary, attendance)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score_average = VALUES(score_average),
           ai_summary = VALUES(ai_summary),
           attendance = VALUES(attendance)`, [classId, student.userId, student.scoreAverage ?? 0, student.aiSummary ?? null, student.attendance ?? null]);
        }
        await client.commit();
    }
    catch (error) {
        await client.rollback();
        throw error;
    }
    finally {
        client.release();
    }
}
// Updates ONLY the score_average for a student in a class.
// Attendance is teacher-managed and must NOT be touched here.
export async function updateClassStudentScore(classId, userId, scorePercentage) {
    await db.query(`INSERT INTO class_student (id_class, id_user, score_average)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score_average = VALUES(score_average)`, [classId, userId, scorePercentage]);
}
export async function recordClassStudentTopics(classId, entries) {
    if (!entries.length)
        return;
    const client = await db.getClient();
    try {
        await client.beginTransaction();
        for (const entry of entries) {
            await client.query(`INSERT INTO class_student_topic (id_class, id_user, id_topic, score, ai_summary)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           score = VALUES(score),
           ai_summary = VALUES(ai_summary)`, [classId, entry.userId, entry.topicId, entry.score ?? 0, entry.aiSummary ?? null]);
        }
        await client.commit();
    }
    catch (error) {
        await client.rollback();
        throw error;
    }
    finally {
        client.release();
    }
}
export async function listAttendance(classId) {
    const result = await db.query(`SELECT 
        u.id_user, 
        u.username, 
        u.email, 
        cs.attendance, 
        cs.score_average, 
        cs.ai_summary
     FROM class_student cs
     INNER JOIN user u ON u.id_user = cs.id_user
     WHERE cs.id_class = ?
     ORDER BY u.name, u.username`, [classId]);
    return result.rows;
}
export async function listClassesForStudent(studentId, filters) {
    const conditions = ['us.id_user = ?'];
    const params = [studentId];
    if (filters?.status) {
        conditions.push('c.status = ?');
        params.push(filters.status);
    }
    if (filters?.startDate && filters?.endDate) {
        conditions.push('c.start_time BETWEEN ? AND ?');
        params.push(filters.startDate, filters.endDate);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const result = await db.query(`SELECT
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
     ORDER BY c.start_time DESC`, params);
    return result.rows;
}
export async function upsertStudentAttendance(classId, userId, attendance = 1) {
    try {
        await db.query(`INSERT INTO class_student (id_class, id_user, attendance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE attendance = VALUES(attendance)`, [classId, userId, attendance]);
    }
    catch (err) {
        console.error('Error auto-joining class:', err.message);
    }
}
export async function getStudentClassData(classId, userId) {
    const result = await db.query(`SELECT attendance, score_average, ai_summary, interaction_coefficient
     FROM class_student
     WHERE id_class = ? AND id_user = ?`, [classId, userId]);
    return result.rows[0];
}
export async function getStudentClassTopics(classId, userId) {
    const result = await db.query(`SELECT 
        cst.id_topic, 
        t.name as topic_name, 
        cst.score, 
        cst.ai_summary
     FROM class_student_topic cst
     INNER JOIN topic t ON t.id_topic = cst.id_topic
     WHERE cst.id_class = ? AND cst.id_user = ?`, [classId, userId]);
    return result.rows;
}
export async function findActiveClassForStudent(studentId) {
    // Finds a class that is 'running' and belongs to a section the student is enrolled in
    const result = await db.query(`SELECT c.id_class 
     FROM class c
     INNER JOIN user_section us ON us.id_section = c.id_section
     WHERE us.id_user = ? AND c.status = 'running'
     ORDER BY c.start_time DESC
     LIMIT 1`, [studentId]);
    return result.rows[0]?.id_class || null;
}
