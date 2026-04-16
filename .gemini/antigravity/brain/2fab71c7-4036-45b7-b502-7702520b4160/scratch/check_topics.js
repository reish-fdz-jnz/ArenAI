import { db } from '../../backend/src/db/pool.js';

async function checkTopics() {
  try {
    const result = await db.query('SELECT id_topic, name, id_subject FROM topic WHERE id_subject = 1');
    console.log('Topics for Subject 1 (Math):');
    console.table(result.rows);
  } catch (err) {
    console.error('Error fetching topics:', err);
  } finally {
    process.exit();
  }
}

checkTopics();
