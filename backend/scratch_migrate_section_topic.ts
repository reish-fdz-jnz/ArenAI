import { db } from './src/db/pool.js';

async function migrate() {
  try {
    console.log("Creating section_topic table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS section_topic (
        id_section_topic INT AUTO_INCREMENT PRIMARY KEY,
        id_section INT NOT NULL,
        id_topic INT NOT NULL,
        id_subject INT NOT NULL,
        score DECIMAL(5,2) DEFAULT NULL,
        base_score_session DECIMAL(5,2) DEFAULT NULL,
        last_class_id INT DEFAULT NULL,
        attempts_count INT DEFAULT 0,
        ai_summary TEXT DEFAULT NULL,
        UNIQUE KEY unique_section_topic (id_section, id_topic)
      )
    `);
    console.log("Table created successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
