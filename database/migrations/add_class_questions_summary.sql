-- Tabla para resúmenes de preguntas de estudiantes por clase
-- Generados por IA basado en chatbot_question_log
-- El profesor los consulta para saber qué están preguntando los estudiantes

CREATE TABLE IF NOT EXISTS class_questions_summary (
    id_summary INT AUTO_INCREMENT PRIMARY KEY,
    id_class INT NOT NULL,
    questions_summary TEXT NOT NULL,
    top_doubts JSON NULL,
    total_questions INT DEFAULT 0,
    avg_frustration VARCHAR(10) DEFAULT 'low',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cqs_class FOREIGN KEY (id_class) REFERENCES class(id_class) ON DELETE CASCADE
);

-- Índice para buscar por clase rápidamente
CREATE INDEX idx_cqs_class ON class_questions_summary(id_class);
CREATE INDEX idx_cqs_generated ON class_questions_summary(generated_at DESC);
