import { db } from '../db/pool.js';
export async function listTopicsBySubject(subjectId) {
    const result = await db.query(`SELECT id_topic, name, id_subject, description
     FROM topic
     WHERE id_subject = ?
     ORDER BY name`, [subjectId]);
    return result.rows;
}
export async function findTopicIdByName(name, subjectId) {
    const normalizedName = name.trim();
    console.log(`[TopicLookup] Searching for: "${normalizedName}" in subjectId: ${subjectId}`);
    const result = await db.query(`SELECT id_topic FROM topic WHERE id_subject = ? AND name = ? LIMIT 1`, [subjectId, normalizedName]);
    if (result.rows.length > 0) {
        console.log(`[TopicLookup] Found match: ID ${result.rows[0].id_topic}`);
        return result.rows[0].id_topic;
    }
    console.log(`[TopicLookup] NO MATCH found for: "${normalizedName}"`);
    return null;
}
export async function findOrCreateTopic(name, subjectId) {
    const normalizedName = name.trim();
    const searchResult = await db.query(`SELECT id_topic FROM topic WHERE id_subject = ? AND name = ? LIMIT 1`, [subjectId, normalizedName]);
    if (searchResult.rows.length > 0) {
        return searchResult.rows[0].id_topic;
    }
    const created = await createTopic({ name: normalizedName, subjectId });
    return created.id_topic;
}
export async function createTopic(payload) {
    const insertResult = await db.query(`INSERT INTO topic (name, id_subject, description)
     VALUES (?, ?, ?)`, [payload.name, payload.subjectId, payload.description ?? null]);
    const created = await db.query(`SELECT id_topic, name, id_subject, description
     FROM topic
     WHERE id_topic = ?`, [insertResult.rows[0].insertId]);
    return created.rows[0];
}
export async function createTopicRelation(payload) {
    const insertResult = await db.query(`INSERT INTO topic_father_son_relation (id_topic_father, id_topic_son, correlation_coefficient)
     VALUES (?, ?, ?)`, [payload.fatherId, payload.sonId, payload.correlation ?? null]);
    const created = await db.query(`SELECT id_topic_father_son_relation
     FROM topic_father_son_relation
     WHERE id_topic_father_son_relation = ?`, [insertResult.rows[0].insertId]);
    return created.rows[0];
}
export async function createTopicResource(payload) {
    const insertResult = await db.query(`INSERT INTO topic_resource (id_topic, resource_source, description, resource_quality)
     VALUES (?, ?, ?, ?)`, [payload.topicId, payload.source, payload.description ?? null, payload.quality ?? null]);
    const created = await db.query(`SELECT id_topic_resource, id_topic, resource_source, description, resource_quality
     FROM topic_resource
     WHERE id_topic_resource = ?`, [insertResult.rows[0].insertId]);
    return created.rows[0];
}
export async function listTopicResources(topicId) {
    const result = await db.query(`SELECT id_topic_resource, id_topic, resource_source, description, resource_quality
     FROM topic_resource
     WHERE id_topic = ?
     ORDER BY id_topic_resource`, [topicId]);
    return result.rows;
}
export async function getTopicById(topicId) {
    const result = await db.query(`SELECT t.id_topic, t.name, t.id_subject, t.description, s.name_subject as subject_name
     FROM topic t
     INNER JOIN subject s ON s.id_subject = t.id_subject
     WHERE t.id_topic = ?`, [topicId]);
    return result.rows[0] || null;
}
export async function getTopicRelations(topicId, userId) {
    const result = await db.query(`(SELECT t.id_topic, t.name, 'father' as type, rel.correlation_coefficient, st.score
      FROM topic_father_son_relation rel
      INNER JOIN topic t ON t.id_topic = rel.id_topic_father
      LEFT JOIN student_topic st ON st.id_topic = t.id_topic AND st.id_user = ?
      WHERE rel.id_topic_son = ?)
     UNION
     (SELECT t.id_topic, t.name, 'son' as type, rel.correlation_coefficient, st.score
      FROM topic_father_son_relation rel
      INNER JOIN topic t ON t.id_topic = rel.id_topic_son
      LEFT JOIN student_topic st ON st.id_topic = t.id_topic AND st.id_user = ?
      WHERE rel.id_topic_father = ?)`, [userId || null, topicId, userId || null, topicId]);
    return result.rows;
}
