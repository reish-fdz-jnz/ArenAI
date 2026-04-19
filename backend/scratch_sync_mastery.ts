import { db } from './src/db/pool.js';

async function syncExistingData() {
  try {
    console.log('--- Syncing existing session scores to permanent mastery ---');
    
    // We'll take the average of all session scores for each user/topic pair 
    // and insert it into student_topic if it's currently empty, 
    // or update it if needed.
    const result = await db.query(`
      INSERT INTO student_topic (id_user, id_topic, score)
      SELECT id_user, id_topic, AVG(score) as score
      FROM class_student_topic
      GROUP BY id_user, id_topic
      ON DUPLICATE KEY UPDATE score = (student_topic.score + VALUES(score)) / 2
    `);

    console.log('Sync complete. Affected rows:', result.rows);
    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

syncExistingData();
