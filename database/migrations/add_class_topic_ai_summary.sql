-- ==========================================================
-- MIGRATION: Add ai_summary and last_analysis_at columns
-- to class_topic table for per-topic class AI summaries
-- ==========================================================
-- The existing class_topic table only has score_average.
-- We need ai_summary and last_analysis_at to store the
-- AI-generated per-topic class summaries (just like student_topic).

ALTER TABLE `class_topic`
    ADD COLUMN `ai_summary` TEXT NULL AFTER `score_average`,
    ADD COLUMN `last_analysis_at` TIMESTAMP NULL AFTER `ai_summary`;
