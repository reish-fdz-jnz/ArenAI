-- ==========================================================
-- MIGRATION: Create chatbot_question_log table
-- ==========================================================
-- Stores structured metadata for every student question in the chatbot.
-- Used by cron job to generate per-topic class summaries and
-- by the professor dashboard to view student questions.

CREATE TABLE IF NOT EXISTS `chatbot_question_log` (
    `id_log` BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- Links
    `id_user` INT NOT NULL,
    `id_class` INT NULL,                                    -- NULL = independent study
    `id_subject` INT NOT NULL,

    -- Classified metadata
    `topic_detected` VARCHAR(255) NULL,                     -- Topic name detected by heuristic/AI
    `id_topic_detected` INT NULL,                           -- Topic ID if matched to DB
    `frustration_level` ENUM('low', 'medium', 'high') DEFAULT 'low',

    -- Content
    `question_text` TEXT NOT NULL,
    `ai_response_summary` VARCHAR(500) NULL,                -- First ~200 chars of AI response

    -- Processing flags
    `is_synced_to_report` BOOLEAN DEFAULT FALSE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    CONSTRAINT `fk_cql_user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
    CONSTRAINT `fk_cql_subject` FOREIGN KEY (`id_subject`) REFERENCES `subject` (`id_subject`),
    CONSTRAINT `fk_cql_class` FOREIGN KEY (`id_class`) REFERENCES `class` (`id_class`) ON DELETE SET NULL,
    CONSTRAINT `fk_cql_topic` FOREIGN KEY (`id_topic_detected`) REFERENCES `topic` (`id_topic`) ON DELETE SET NULL
);

-- Index for cron job sync
CREATE INDEX `idx_cql_sync` ON `chatbot_question_log` (`is_synced_to_report`, `id_class`);
-- Index for user+subject queries
CREATE INDEX `idx_cql_user_subject` ON `chatbot_question_log` (`id_user`, `id_subject`, `created_at`);
-- Index for class-based queries (professor view)
CREATE INDEX `idx_cql_class` ON `chatbot_question_log` (`id_class`, `created_at`);
