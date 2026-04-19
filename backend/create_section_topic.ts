import { db } from './src/db/pool.js';

async function run() {
    console.log("Starting section_topic table creation...");
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS section_topic (
                id_section_topic INT AUTO_INCREMENT PRIMARY KEY,
                id_section INT NOT NULL,
                id_topic INT NOT NULL,
                score DECIMAL(5, 2) DEFAULT 0,
                ai_summary TEXT,
                base_score_session DECIMAL(5, 2),
                last_class_id INT,
                last_analysis_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE(id_section, id_topic),
                FOREIGN KEY (id_section) REFERENCES section(id_section) ON DELETE CASCADE,
                FOREIGN KEY (id_topic) REFERENCES topic(id_topic) ON DELETE CASCADE
            )
        `);
        console.log("Table section_topic created successfully.");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        process.exit(0);
    }
}

run();
