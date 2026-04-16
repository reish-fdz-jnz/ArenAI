import type { ResultSetHeader } from 'mysql2';
import { db } from '../db/pool.js';
import type { Topic } from '../types.js';

export interface TopicResource {
  id_topic_resource: number;
  id_topic: number;
  resource_source: string;
  description: string | null;
  resource_quality: string | null;
}

export async function listTopicsBySubject(subjectId: number) {
  const result = await db.query<Topic>(
    `SELECT id_topic, name, id_subject, description
     FROM topic
     WHERE id_subject = ?
     ORDER BY name`,
    [subjectId]
  );

  return result.rows;
}

export async function findTopicIdByName(name: string, subjectId: number): Promise<number | null> {
  const normalizedName = name.trim();
  console.log(`[TopicLookup] Searching for: "${normalizedName}" in subjectId: ${subjectId}`);
  
  const result = await db.query<{ id_topic: number }>(
    `SELECT id_topic FROM topic WHERE id_subject = ? AND name = ? LIMIT 1`,
    [subjectId, normalizedName]
  );
  
  if (result.rows.length > 0) {
    console.log(`[TopicLookup] Found match: ID ${result.rows[0].id_topic}`);
    return result.rows[0].id_topic;
  }
  
  console.log(`[TopicLookup] NO MATCH found for: "${normalizedName}"`);
  return null;
}

export async function findOrCreateTopic(name: string, subjectId: number): Promise<number> {
  const normalizedName = name.trim();
  const searchResult = await db.query<{ id_topic: number }>(
    `SELECT id_topic FROM topic WHERE id_subject = ? AND name = ? LIMIT 1`,
    [subjectId, normalizedName]
  );
  
  if (searchResult.rows.length > 0) {
    return searchResult.rows[0].id_topic;
  }
  
  const created = await createTopic({ name: normalizedName, subjectId });
  return (created as any).id_topic;
}

export async function createTopic(payload: { name: string; subjectId: number; description?: string | null }) {
  const insertResult = await db.query<ResultSetHeader>(
    `INSERT INTO topic (name, id_subject, description)
     VALUES (?, ?, ?)`,
    [payload.name, payload.subjectId, payload.description ?? null]
  );

  const created = await db.query<Topic>(
    `SELECT id_topic, name, id_subject, description
     FROM topic
     WHERE id_topic = ?`,
    [insertResult.rows[0].insertId]
  );

  return created.rows[0];
}

export async function createTopicRelation(payload: { fatherId: number; sonId: number; correlation?: number | null }) {
  const insertResult = await db.query<ResultSetHeader>(
    `INSERT INTO topic_father_son_relation (id_topic_father, id_topic_son, correlation_coefficient)
     VALUES (?, ?, ?)`,
    [payload.fatherId, payload.sonId, payload.correlation ?? null]
  );

  const created = await db.query<{ id_topic_father_son_relation: number }>(
    `SELECT id_topic_father_son_relation
     FROM topic_father_son_relation
     WHERE id_topic_father_son_relation = ?`,
    [insertResult.rows[0].insertId]
  );

  return created.rows[0];
}

export async function createTopicResource(payload: { topicId: number; source: string; description?: string | null; quality?: number | null }) {
  const insertResult = await db.query<ResultSetHeader>(
    `INSERT INTO topic_resource (id_topic, resource_source, description, resource_quality)
     VALUES (?, ?, ?, ?)`,
    [payload.topicId, payload.source, payload.description ?? null, payload.quality ?? null]
  );

  const created = await db.query<TopicResource>(
    `SELECT id_topic_resource, id_topic, resource_source, description, resource_quality
     FROM topic_resource
     WHERE id_topic_resource = ?`,
    [insertResult.rows[0].insertId]
  );

  return created.rows[0];
}

export async function listTopicResources(topicId: number) {
  const result = await db.query<TopicResource>(
    `SELECT id_topic_resource, id_topic, resource_source, description, resource_quality
     FROM topic_resource
     WHERE id_topic = ?
     ORDER BY id_topic_resource`,
    [topicId]
  );

  return result.rows;
}
