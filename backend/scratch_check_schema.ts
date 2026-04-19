import { db } from './src/db/pool.js';

async function checkSchema() {
  try {
    console.log('--- Checking student_topic table ---');
    const studentTopicCols = await db.query('SHOW COLUMNS FROM student_topic');
    console.log(studentTopicCols.rows);

    console.log('\n--- Checking topic_father_son_relation table ---');
    try {
      const relationCols = await db.query('SHOW COLUMNS FROM topic_father_son_relation');
      console.log(relationCols.rows);
    } catch (e) {
      console.log('topic_father_son_relation table DOES NOT EXIST');
    }

    process.exit(0);
  } catch (error) {
    console.error('Schema check failed:', error);
    process.exit(1);
  }
}

checkSchema();
