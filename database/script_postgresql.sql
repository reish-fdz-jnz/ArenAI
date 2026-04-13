-- ============================================================
-- ArenAI – PostgreSQL schema
-- Equivalent to script.sql (MySQL)
-- ============================================================

-- -------------------------------------------------------
-- Custom ENUM types
-- -------------------------------------------------------
CREATE TYPE matchmaking_status AS ENUM ('waiting', 'matched', 'cancelled');
CREATE TYPE battle_status      AS ENUM ('waiting', 'active', 'completed', 'cancelled');
CREATE TYPE chat_role          AS ENUM ('user', 'model');
CREATE TYPE friend_req_status  AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE submission_status  AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED');
CREATE TYPE target_type_enum   AS ENUM ('SECTION', 'STUDENT');

-- -------------------------------------------------------
-- institution
-- -------------------------------------------------------
CREATE TABLE institution (
    id_institution   SERIAL       PRIMARY KEY,
    name_institution VARCHAR(255) NOT NULL UNIQUE,
    score_average    NUMERIC(5,2)
);

-- -------------------------------------------------------
-- grade_score_average
-- -------------------------------------------------------
CREATE TABLE grade_score_average (
    id_grade_average SERIAL       PRIMARY KEY,
    id_institution   INT          NOT NULL,
    grade            VARCHAR(100) NOT NULL,
    score            NUMERIC(5,2),
    UNIQUE (id_institution, grade),
    CONSTRAINT fk_grade_score_institution
        FOREIGN KEY (id_institution) REFERENCES institution (id_institution)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- section
-- -------------------------------------------------------
CREATE TABLE section (
    id_section     SERIAL       PRIMARY KEY,
    section_number VARCHAR(10)  NOT NULL,
    grade          VARCHAR(100) NOT NULL,
    id_institution INT          NOT NULL,
    UNIQUE (id_institution, section_number),
    CONSTRAINT fk_section_institution
        FOREIGN KEY (id_institution) REFERENCES institution (id_institution)
);

-- -------------------------------------------------------
-- subject
-- -------------------------------------------------------
CREATE TABLE subject (
    id_subject   SERIAL       PRIMARY KEY,
    name_subject VARCHAR(255) NOT NULL UNIQUE
);

-- -------------------------------------------------------
-- class
-- -------------------------------------------------------
CREATE TABLE class (
    id_class      SERIAL        PRIMARY KEY,
    name_class    VARCHAR(255)  NOT NULL,
    id_subject    INT           NOT NULL,
    id_section    INT           NOT NULL,
    fecha         DATE,
    score_average NUMERIC(5,2),
    UNIQUE (id_subject, id_section, name_class),
    CONSTRAINT fk_class_section
        FOREIGN KEY (id_section) REFERENCES section (id_section),
    CONSTRAINT fk_class_subject
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject)
);

CREATE INDEX idx_class__subject_section
    ON class (id_subject, id_section, fecha);

-- -------------------------------------------------------
-- professor_class_report
-- -------------------------------------------------------
CREATE TABLE professor_class_report (
    id_report            BIGSERIAL    PRIMARY KEY,
    id_class             INT          NOT NULL,
    general_summary      TEXT         NOT NULL,
    top_confusion_topics JSONB,
    sentiment_average    VARCHAR(50),
    suggested_action     TEXT,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_class),
    CONSTRAINT fk_pcr_class
        FOREIGN KEY (id_class) REFERENCES class (id_class)
            ON DELETE CASCADE
);

CREATE INDEX idx_pcr_class_date
    ON professor_class_report (id_class, created_at);

-- -------------------------------------------------------
-- topic
-- -------------------------------------------------------
CREATE TABLE topic (
    id_topic    SERIAL       PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    id_subject  INT          NOT NULL,
    description TEXT,
    UNIQUE (id_subject, name),
    CONSTRAINT fk_topic_subject
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject)
);

CREATE INDEX idx_topic__subject
    ON topic (id_subject);

-- -------------------------------------------------------
-- class_topic
-- -------------------------------------------------------
CREATE TABLE class_topic (
    id_class_topic SERIAL        PRIMARY KEY,
    id_class       INT           NOT NULL,
    id_topic       INT           NOT NULL,
    score_average  NUMERIC(5,2),
    UNIQUE (id_class, id_topic),
    CONSTRAINT fk_class_topic_class
        FOREIGN KEY (id_class) REFERENCES class (id_class)
            ON DELETE CASCADE,
    CONSTRAINT fk_class_topic_topic
        FOREIGN KEY (id_topic) REFERENCES topic (id_topic)
);

CREATE INDEX idx_class_topic__topic
    ON class_topic (id_topic);

-- Trigger: enforce same subject on INSERT / UPDATE
CREATE OR REPLACE FUNCTION fn_enforce_same_subject()
RETURNS TRIGGER AS $$
DECLARE
    v_class_subject INT;
    v_topic_subject INT;
BEGIN
    SELECT id_subject INTO v_class_subject FROM class WHERE id_class = NEW.id_class;
    SELECT id_subject INTO v_topic_subject FROM topic WHERE id_topic = NEW.id_topic;

    IF v_class_subject IS NULL OR v_topic_subject IS NULL OR v_class_subject <> v_topic_subject THEN
        RAISE EXCEPTION 'class_topic: topic no pertenece a la misma subject que class';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_same_subject_ins
    BEFORE INSERT ON class_topic
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_same_subject();

CREATE TRIGGER trg_enforce_same_subject_upd
    BEFORE UPDATE ON class_topic
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_same_subject();

-- -------------------------------------------------------
-- topic_father_son_relation
-- -------------------------------------------------------
CREATE TABLE topic_father_son_relation (
    id_topic_father_son_relation SERIAL        PRIMARY KEY,
    id_topic_father              INT           NOT NULL,
    id_topic_son                 INT           NOT NULL,
    correlation_coefficient      NUMERIC(5,2),
    CONSTRAINT fk_topic_relation_father
        FOREIGN KEY (id_topic_father) REFERENCES topic (id_topic)
            ON DELETE CASCADE,
    CONSTRAINT fk_topic_relation_son
        FOREIGN KEY (id_topic_son) REFERENCES topic (id_topic)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- topic_resource
-- -------------------------------------------------------
CREATE TABLE topic_resource (
    id_topic_resource SERIAL         PRIMARY KEY,
    id_topic          INT            NOT NULL,
    resource_source   VARCHAR(1024)  NOT NULL,
    description       TEXT,
    resource_quality  NUMERIC(5,2),
    CONSTRAINT fk_topic_resource_topic
        FOREIGN KEY (id_topic) REFERENCES topic (id_topic)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- "user" (quoted because user is a reserved word in PostgreSQL)
-- -------------------------------------------------------
CREATE TABLE "user" (
    id_user              SERIAL        PRIMARY KEY,
    username             VARCHAR(100)  NOT NULL UNIQUE,
    email                VARCHAR(255),
    password_hash        VARCHAR(255)  NOT NULL,
    name                 VARCHAR(150),
    last_name            VARCHAR(200),
    phone_number         VARCHAR(50),
    id_institution       INT,
    role                 VARCHAR(30),
    profile_picture_name VARCHAR(50),
    first_login          BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_user_institution
        FOREIGN KEY (id_institution) REFERENCES institution (id_institution)
            ON DELETE SET NULL
);

-- -------------------------------------------------------
-- battle_matchmaking
-- -------------------------------------------------------
CREATE TABLE battle_matchmaking (
    id_matchmaking SERIAL              PRIMARY KEY,
    id_user        INT                 NOT NULL,
    id_subject     INT                 NOT NULL,
    id_class       INT                 NOT NULL,
    created_at     TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    status         matchmaking_status  DEFAULT 'waiting',
    matched_at     TIMESTAMP,
    CONSTRAINT battle_matchmaking_ibfk_1
        FOREIGN KEY (id_user)    REFERENCES "user" (id_user),
    CONSTRAINT battle_matchmaking_ibfk_2
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject),
    CONSTRAINT battle_matchmaking_ibfk_3
        FOREIGN KEY (id_class)   REFERENCES class (id_class)
);

CREATE INDEX idx_bm_class   ON battle_matchmaking (id_class);
CREATE INDEX idx_bm_subject ON battle_matchmaking (id_subject);
CREATE INDEX idx_bm_user    ON battle_matchmaking (id_user);

-- -------------------------------------------------------
-- battle_minigame
-- -------------------------------------------------------
CREATE TABLE battle_minigame (
    id_battle_minigame SERIAL         PRIMARY KEY,
    id_user_1          INT            DEFAULT 100,
    id_user_2          INT            DEFAULT 100,
    id_class           INT,
    user_1_health      INT,
    user_2_health      INT,
    winner             BOOLEAN,
    id_subject         INT,
    status             battle_status  DEFAULT 'waiting',
    created_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    started_at         TIMESTAMP,
    ended_at           TIMESTAMP,
    CONSTRAINT battle_minigame_ibfk_1
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject),
    CONSTRAINT battle_minigame_ibfk_2
        FOREIGN KEY (id_user_2)  REFERENCES "user" (id_user),
    CONSTRAINT battle_minigame_ibfk_3
        FOREIGN KEY (id_class)   REFERENCES class (id_class),
    CONSTRAINT battle_minigame_ibfk_4
        FOREIGN KEY (id_user_1)  REFERENCES "user" (id_user)
);

CREATE INDEX idx_bmg_class   ON battle_minigame (id_class);
CREATE INDEX idx_bmg_subject ON battle_minigame (id_subject);
CREATE INDEX idx_bmg_user1   ON battle_minigame (id_user_1);
CREATE INDEX idx_bmg_user2   ON battle_minigame (id_user_2);

-- -------------------------------------------------------
-- battle_minigame_question
-- -------------------------------------------------------
CREATE TABLE battle_minigame_question (
    id_battle_minigame_question SERIAL       PRIMARY KEY,
    id_battle_minigame          INT,
    id_topic                    INT,
    question                    VARCHAR(500),
    answer1                     VARCHAR(50),
    answer2                     VARCHAR(50),
    answer3                     VARCHAR(50),
    answer4                     VARCHAR(50),
    CONSTRAINT battle_minigame_question_ibfk_1
        FOREIGN KEY (id_battle_minigame) REFERENCES battle_minigame (id_battle_minigame),
    CONSTRAINT battle_minigame_question_ibfk_2
        FOREIGN KEY (id_topic) REFERENCES topic (id_topic)
);

CREATE INDEX idx_bmq_battle ON battle_minigame_question (id_battle_minigame);
CREATE INDEX idx_bmq_topic  ON battle_minigame_question (id_topic);

-- -------------------------------------------------------
-- chat
-- -------------------------------------------------------
CREATE TABLE chat (
    id_chat              SERIAL       PRIMARY KEY,
    id_user_1            INT,
    id_user_2            INT,
    friendship           BOOLEAN,
    last_message_at      TIMESTAMP,
    last_message_preview VARCHAR(100),
    CONSTRAINT chat_ibfk_1
        FOREIGN KEY (id_user_1) REFERENCES "user" (id_user),
    CONSTRAINT chat_ibfk_2
        FOREIGN KEY (id_user_2) REFERENCES "user" (id_user)
);

CREATE INDEX idx_chat_user1 ON chat (id_user_1);
CREATE INDEX idx_chat_user2 ON chat (id_user_2);

-- -------------------------------------------------------
-- student_profile  (created before class_student so triggers can reference it)
-- -------------------------------------------------------
CREATE TABLE student_profile (
    id_user        INT           PRIMARY KEY,
    email_guardian VARCHAR(255),
    score_average  NUMERIC(5,2),
    quiz_streak    INT,
    CONSTRAINT fk_student_profile_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- class_student
-- -------------------------------------------------------
CREATE TABLE class_student (
    id_class                INT           NOT NULL,
    id_user                 INT           NOT NULL,
    ai_summary              TEXT,
    interaction_coefficient NUMERIC(5,2),
    score_average           NUMERIC(5,2),
    attendance              BOOLEAN       DEFAULT FALSE,
    PRIMARY KEY (id_class, id_user),
    CONSTRAINT fk_class_student_class
        FOREIGN KEY (id_class) REFERENCES class (id_class)
            ON DELETE CASCADE,
    CONSTRAINT fk_class_student_user
        FOREIGN KEY (id_user)  REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

CREATE INDEX idx_class_student__user
    ON class_student (id_user);

-- Trigger: student profile check on class_student
CREATE OR REPLACE FUNCTION fn_cs_student_check()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM student_profile WHERE id_user = NEW.id_user) THEN
        RAISE EXCEPTION 'El usuario indicado no tiene perfil de estudiante';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cs_student_check_ins
    BEFORE INSERT ON class_student
    FOR EACH ROW EXECUTE FUNCTION fn_cs_student_check();

CREATE TRIGGER trg_cs_student_check_upd
    BEFORE UPDATE ON class_student
    FOR EACH ROW EXECUTE FUNCTION fn_cs_student_check();

-- -------------------------------------------------------
-- class_student_topic
-- -------------------------------------------------------
CREATE TABLE class_student_topic (
    id_class   INT           NOT NULL,
    id_topic   INT           NOT NULL,
    id_user    INT           NOT NULL,
    score      NUMERIC(5,2),
    ai_summary TEXT,
    PRIMARY KEY (id_class, id_topic, id_user),
    CONSTRAINT fk_cst_class_student
        FOREIGN KEY (id_class, id_user) REFERENCES class_student (id_class, id_user)
            ON DELETE CASCADE,
    CONSTRAINT fk_cst_class_topic
        FOREIGN KEY (id_class, id_topic) REFERENCES class_topic (id_class, id_topic)
            ON DELETE CASCADE
);

CREATE INDEX idx_class_student_topic__user
    ON class_student_topic (id_user);

-- Trigger: student profile check on class_student_topic
CREATE OR REPLACE FUNCTION fn_cst_student_check()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM student_profile WHERE id_user = NEW.id_user) THEN
        RAISE EXCEPTION 'El usuario indicado no tiene perfil de estudiante';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cst_student_check_ins
    BEFORE INSERT ON class_student_topic
    FOR EACH ROW EXECUTE FUNCTION fn_cst_student_check();

CREATE TRIGGER trg_cst_student_check_upd
    BEFORE UPDATE ON class_student_topic
    FOR EACH ROW EXECUTE FUNCTION fn_cst_student_check();

-- -------------------------------------------------------
-- friend_requests
-- -------------------------------------------------------











CREATE TABLE friend_requests (
    id_request  SERIAL            PRIMARY KEY,
    id_sender   INT               NOT NULL,
    id_receiver INT               NOT NULL,
    status      friend_req_status DEFAULT 'pending',
    created_at  TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_sender, id_receiver),
    CONSTRAINT fk_fr_receiver
        FOREIGN KEY (id_receiver) REFERENCES "user" (id_user)
            ON DELETE CASCADE,
    CONSTRAINT fk_fr_sender
        FOREIGN KEY (id_sender) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

-- Auto-update updated_at on friend_requests
CREATE OR REPLACE FUNCTION fn_fr_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fr_update_timestamp
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW EXECUTE FUNCTION fn_fr_update_timestamp();

-- -------------------------------------------------------
-- learning_chat_history
-- -------------------------------------------------------
CREATE TABLE learning_chat_history (
    id_message  BIGSERIAL    PRIMARY KEY,
    id_user     INT          NOT NULL,
    id_subject  INT          NOT NULL,
    id_class    INT,
    role        chat_role    NOT NULL,
    content     TEXT         NOT NULL,
    is_analyzed BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lch_class
        FOREIGN KEY (id_class)   REFERENCES class (id_class)
            ON DELETE SET NULL,
    CONSTRAINT fk_lch_subject
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject),
    CONSTRAINT fk_lch_user
        FOREIGN KEY (id_user)    REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

CREATE INDEX idx_lch_analysis_queue
    ON learning_chat_history (id_user, is_analyzed);

CREATE INDEX idx_lch_history
    ON learning_chat_history (id_user, id_subject, created_at);

-- -------------------------------------------------------
-- message
-- -------------------------------------------------------
CREATE TABLE message (
    id_message SERIAL    PRIMARY KEY,
    id_chat    INT,
    id_user    INT,
    content    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read    BOOLEAN   DEFAULT FALSE,
    text       TEXT,
    date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_ibfk_1
        FOREIGN KEY (id_chat) REFERENCES chat (id_chat),
    CONSTRAINT message_ibfk_2
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
);

CREATE INDEX idx_msg_user      ON message (id_user);
CREATE INDEX idx_message_chat_time ON message (id_chat, created_at);
CREATE INDEX idx_message_unread    ON message (id_chat, is_read);

-- Trigger: update chat preview after message insert
CREATE OR REPLACE FUNCTION fn_update_chat_preview()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat
       SET last_message_at      = NEW.created_at,
           last_message_preview = LEFT(NEW.content, 100)
     WHERE id_chat = NEW.id_chat;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_chat_preview
    AFTER INSERT ON message
    FOR EACH ROW EXECUTE FUNCTION fn_update_chat_preview();

-- -------------------------------------------------------
-- professor_profile
-- -------------------------------------------------------
CREATE TABLE professor_profile (
    id_user INT          PRIMARY KEY,
    grade   VARCHAR(100),
    CONSTRAINT fk_professor_profile_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- quiz
-- -------------------------------------------------------
CREATE TABLE quiz (
    id_quiz      SERIAL        PRIMARY KEY,
    id_professor INT           NOT NULL,
    id_subject   INT           NOT NULL,
    quiz_name    VARCHAR(100)  NOT NULL,
    description  VARCHAR(500),
    level        VARCHAR(20)   NOT NULL,
    language     VARCHAR(20),
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    is_public    BOOLEAN       DEFAULT TRUE,
    downloads    INT           DEFAULT 0,
    avg_rating   NUMERIC(2,1)  DEFAULT 0.0,
    rating_count INT           DEFAULT 0,
    CONSTRAINT quiz_ibfk_1
        FOREIGN KEY (id_professor) REFERENCES "user" (id_user),
    CONSTRAINT quiz_ibfk_2
        FOREIGN KEY (id_subject) REFERENCES subject (id_subject)
);

CREATE INDEX idx_quiz_professor ON quiz (id_professor);
CREATE INDEX idx_quiz_subject   ON quiz (id_subject);

-- -------------------------------------------------------
-- assignment
-- -------------------------------------------------------
CREATE TABLE assignment (
    id_assignment          SERIAL        PRIMARY KEY,
    id_professor           INT           NOT NULL,
    id_section             INT,
    due_time               DATE,
    id_quiz                INT,
    win_battle_requirement SMALLINT,
    id_subject             INT,
    min_battle_wins        INT           DEFAULT 0,
    title                  VARCHAR(255)  NOT NULL DEFAULT 'Assignment',
    description            TEXT,
    due_date               TIMESTAMP,
    min_win_streak         INT           DEFAULT 0,
    required_text_response BOOLEAN       DEFAULT FALSE,
    created_at             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assignment_ibfk_1
        FOREIGN KEY (id_subject)    REFERENCES subject (id_subject),
    CONSTRAINT assignment_ibfk_2
        FOREIGN KEY (id_quiz)       REFERENCES quiz (id_quiz),
    CONSTRAINT assignment_ibfk_3
        FOREIGN KEY (id_section)    REFERENCES section (id_section),
    CONSTRAINT fk_assignment_professor
        FOREIGN KEY (id_professor)  REFERENCES "user" (id_user)
);

CREATE INDEX idx_assignment_quiz    ON assignment (id_quiz);
CREATE INDEX idx_assignment_section ON assignment (id_section);
CREATE INDEX idx_assignment_subject ON assignment (id_subject);

-- -------------------------------------------------------
-- assignment_submission
-- -------------------------------------------------------
CREATE TABLE assignment_submission (
    id_submission       SERIAL            PRIMARY KEY,
    id_assignment       INT               NOT NULL,
    id_student          INT               NOT NULL,
    status              submission_status DEFAULT 'NOT_STARTED',
    win_streak_achieved INT               DEFAULT 0,
    text_response       TEXT,
    started_at          TIMESTAMP,
    submitted_at        TIMESTAMP,
    graded_at           TIMESTAMP,
    grade               NUMERIC(5,2),
    feedback            TEXT,
    UNIQUE (id_assignment, id_student),
    CONSTRAINT fk_sub_assignment
        FOREIGN KEY (id_assignment) REFERENCES assignment (id_assignment)
            ON DELETE CASCADE,
    CONSTRAINT fk_sub_student
        FOREIGN KEY (id_student) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

CREATE INDEX idx_sub_status  ON assignment_submission (status);
CREATE INDEX idx_sub_student ON assignment_submission (id_student);

-- -------------------------------------------------------
-- assignment_target
-- -------------------------------------------------------
CREATE TABLE assignment_target (
    id_assignment_target SERIAL           PRIMARY KEY,
    id_assignment        INT              NOT NULL,
    target_type          target_type_enum NOT NULL,
    target_id            INT              NOT NULL,
    CONSTRAINT fk_target_assignment
        FOREIGN KEY (id_assignment) REFERENCES assignment (id_assignment)
            ON DELETE CASCADE
);

CREATE INDEX idx_target_assignment ON assignment_target (id_assignment);
CREATE INDEX idx_target_lookup     ON assignment_target (target_type, target_id);

-- -------------------------------------------------------
-- quiz_attempt
-- -------------------------------------------------------
CREATE TABLE quiz_attempt (
    id_attempt       SERIAL        PRIMARY KEY,
    id_quiz          INT           NOT NULL,
    id_student       INT           NOT NULL,
    started_at       TIMESTAMP     NOT NULL,
    finished_at      TIMESTAMP,
    total_score      NUMERIC(5,2)  DEFAULT 0.00,
    focus_lost_count INT           DEFAULT 0,
    CONSTRAINT quiz_attempt_ibfk_1
        FOREIGN KEY (id_quiz)    REFERENCES quiz (id_quiz)
            ON DELETE CASCADE,
    CONSTRAINT quiz_attempt_ibfk_2
        FOREIGN KEY (id_student) REFERENCES "user" (id_user)
);

CREATE INDEX idx_qa_quiz    ON quiz_attempt (id_quiz);
CREATE INDEX idx_qa_student ON quiz_attempt (id_student);

-- -------------------------------------------------------
-- quiz_question
-- -------------------------------------------------------
CREATE TABLE quiz_question (
    id_question              SERIAL        PRIMARY KEY,
    id_quiz                  INT           NOT NULL,
    id_topic                 INT,
    question_text            TEXT          NOT NULL,
    points                   NUMERIC(5,2)  DEFAULT 1.00,
    allow_multiple_selection BOOLEAN       DEFAULT FALSE,
    option_1                 VARCHAR(255)  NOT NULL,
    option_2                 VARCHAR(255)  NOT NULL,
    option_3                 VARCHAR(255),
    option_4                 VARCHAR(255),
    correct_options          VARCHAR(50)   NOT NULL,
    CONSTRAINT quiz_question_ibfk_1
        FOREIGN KEY (id_quiz)  REFERENCES quiz (id_quiz)
            ON DELETE CASCADE,
    CONSTRAINT quiz_question_ibfk_2
        FOREIGN KEY (id_topic) REFERENCES topic (id_topic)
);

CREATE INDEX idx_qq_quiz  ON quiz_question (id_quiz);
CREATE INDEX idx_qq_topic ON quiz_question (id_topic);

-- -------------------------------------------------------
-- quiz_rating
-- -------------------------------------------------------
CREATE TABLE quiz_rating (
    id_rating  SERIAL    PRIMARY KEY,
    id_quiz    INT       NOT NULL,
    id_user    INT       NOT NULL,
    rating     SMALLINT  NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_quiz, id_user),
    CONSTRAINT quiz_rating_ibfk_1
        FOREIGN KEY (id_quiz) REFERENCES quiz (id_quiz)
            ON DELETE CASCADE,
    CONSTRAINT quiz_rating_ibfk_2
        FOREIGN KEY (id_user) REFERENCES "user" (id_user),
    CONSTRAINT chk_rating_range CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX idx_qr_user ON quiz_rating (id_user);

-- -------------------------------------------------------
-- quiz_response
-- -------------------------------------------------------
CREATE TABLE quiz_response (
    id_response        SERIAL        PRIMARY KEY,
    id_attempt         INT           NOT NULL,
    id_question        INT           NOT NULL,
    selected_options   VARCHAR(50),
    is_correct         BOOLEAN       DEFAULT FALSE,
    points_awarded     NUMERIC(5,2)  DEFAULT 0.00,
    time_taken_seconds NUMERIC(5,2),
    CONSTRAINT quiz_response_ibfk_1
        FOREIGN KEY (id_attempt)  REFERENCES quiz_attempt (id_attempt)
            ON DELETE CASCADE,
    CONSTRAINT quiz_response_ibfk_2
        FOREIGN KEY (id_question) REFERENCES quiz_question (id_question)
);

CREATE INDEX idx_qresp_attempt  ON quiz_response (id_attempt);
CREATE INDEX idx_qresp_question ON quiz_response (id_question);

-- -------------------------------------------------------
-- student_class_summary
-- -------------------------------------------------------
CREATE TABLE student_class_summary (
    id_summary                 BIGSERIAL PRIMARY KEY,
    id_class                   INT       NOT NULL,
    id_user                    INT       NOT NULL,
    summary_text               TEXT      NOT NULL,
    strengths                  JSONB,
    weaknesses                 JSONB,
    study_tips                 JSONB,
    is_processed_for_professor BOOLEAN   DEFAULT FALSE,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_class, id_user),
    CONSTRAINT fk_scs_class
        FOREIGN KEY (id_class) REFERENCES class (id_class)
            ON DELETE CASCADE,
    CONSTRAINT fk_scs_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

-- Auto-update updated_at on student_class_summary
CREATE OR REPLACE FUNCTION fn_scs_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scs_update_timestamp
    BEFORE UPDATE ON student_class_summary
    FOR EACH ROW EXECUTE FUNCTION fn_scs_update_timestamp();

-- -------------------------------------------------------
-- student_topic
-- -------------------------------------------------------
CREATE TABLE student_topic (
    id_student_topic SERIAL        PRIMARY KEY,
    id_user          INT           NOT NULL,
    id_topic         INT           NOT NULL,
    score            NUMERIC(5,2),
    UNIQUE (id_user, id_topic),
    CONSTRAINT fk_student_topic_topic
        FOREIGN KEY (id_topic) REFERENCES topic (id_topic)
            ON DELETE CASCADE,
    CONSTRAINT fk_student_topic_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

CREATE INDEX idx_student_topic__user
    ON student_topic (id_user);

-- -------------------------------------------------------
-- submission_quiz_score
-- -------------------------------------------------------
CREATE TABLE submission_quiz_score (
    id            SERIAL        PRIMARY KEY,
    id_submission INT           NOT NULL,
    id_quiz       INT           NOT NULL,
    score         NUMERIC(5,2)  DEFAULT 0.00,
    max_score     NUMERIC(5,2)  DEFAULT 100.00,
    completed_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_submission, id_quiz),
    CONSTRAINT fk_sqs_quiz
        FOREIGN KEY (id_quiz) REFERENCES quiz (id_quiz)
            ON DELETE CASCADE,
    CONSTRAINT fk_sqs_submission
        FOREIGN KEY (id_submission) REFERENCES assignment_submission (id_submission)
            ON DELETE CASCADE
);

CREATE INDEX idx_sqs_submission
    ON submission_quiz_score (id_submission);

-- -------------------------------------------------------
-- user_avatar
-- -------------------------------------------------------
CREATE TABLE user_avatar (
    id_user_avatar   SERIAL      PRIMARY KEY,
    id_user          INT         NOT NULL,
    avatar_type      VARCHAR(50) NOT NULL,
    nickname         VARCHAR(100),
    friendship_level INT         DEFAULT 0,
    is_current       BOOLEAN     DEFAULT FALSE,
    created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ua_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

CREATE INDEX idx_ua_user
    ON user_avatar (id_user);

-- -------------------------------------------------------
-- user_section
-- -------------------------------------------------------
CREATE TABLE user_section (
    id_user         INT         NOT NULL,
    id_section      INT         NOT NULL,
    role_in_section VARCHAR(30),
    PRIMARY KEY (id_user, id_section),
    CONSTRAINT fk_user_section_section
        FOREIGN KEY (id_section) REFERENCES section (id_section)
            ON DELETE CASCADE,
    CONSTRAINT fk_user_section_user
        FOREIGN KEY (id_user) REFERENCES "user" (id_user)
            ON DELETE CASCADE
);

-- -------------------------------------------------------
-- Scheduled cleanup (requires pg_cron extension)
-- To enable: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then run:
--   SELECT cron.schedule(
--       'cleanup_expired_refresh_tokens',
--       '0 2 * * *',   -- daily at 02:00
--       $$DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE$$
--   );
-- -------------------------------------------------------
