import { db } from '../db/pool.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// --- Interfaces ---
export interface QuizRow extends RowDataPacket {
    id_quiz: number;
    quiz_name: string;
    description: string | null;
    id_professor: number;
    id_subject: number;
    level: string;
    language: string | null;
    is_public: boolean;
    downloads: number;
    avg_rating: string | number;
    rating_count: number;
}

export interface QuestionRow extends RowDataPacket {
    id_question: number;
    question_text: string;
    option_1: string;
    option_2: string;
    option_3: string | null;
    option_4: string | null;
    correct_options: string;
    points: string | number;
    allow_multiple_selection: boolean;
    id_topic: number | null;
}

// --- QUIZ SELECTION FOR BATTLE (My Original Logic) ---

// --- QUIZ SELECTION FOR BATTLE (My Original Logic) ---

export async function getRandomQuiz(subjectName: string, grade: string, language?: string): Promise<QuizRow | null> {
    const result = await db.query<RowDataPacket>(
        'SELECT id_subject FROM subject WHERE name_subject = ?',
        [subjectName]
    );
    const subjects = result.rows;

    if (subjects.length === 0) return null;
    const subjectId = (subjects[0] as any).id_subject;

    // Build query with optional language filter
    let query = `SELECT * FROM quiz WHERE id_subject = ? AND level = ?`;
    const params: any[] = [subjectId, grade];

    if (language) {
        query += ` AND (language = ? OR language IS NULL)`;
        params.push(language);
    }

    query += ` ORDER BY RAND() LIMIT 1`;

    const quizResult = await db.query<QuizRow>(query, params);

    return quizResult.rows[0] || null;
}


export async function getQuizQuestions(quizId: number): Promise<any[]> {
    const result = await db.query<QuestionRow>(
        `SELECT *
         FROM quiz_question
         WHERE id_quiz = ?`,
        [quizId]
    );
    const questions = result.rows;

    // Map to frontend format
    return questions.map(q => ({
        id: q.id_question,
        question: q.question_text,
        options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
        correctAnswer: parseCorrectAnswer(q.correct_options, [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean))
    }));
}

function parseCorrectAnswer(correct: string, options: (string | null)[]): number {
    if (correct.toLowerCase() === 'option 1') return 0;
    if (correct.toLowerCase() === 'option 2') return 1;
    if (correct.toLowerCase() === 'option 3') return 2;
    if (correct.toLowerCase() === 'option 4') return 3;
    const idx = options.indexOf(correct);
    return idx !== -1 ? idx : 0;
}

// --- RESTORED METHODS FOR QUIZ SERVICE ---

export async function createQuiz(data: {
    professorId: number;
    subjectId: number;
    name: string;
    description?: string;
    level: string;
    language?: string;
}): Promise<number> {
    const result = await db.query<ResultSetHeader>(
        `INSERT INTO quiz (id_professor, id_subject, quiz_name, description, level, language)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.professorId, data.subjectId, data.name, data.description || null, data.level, data.language || 'en']
    );
    // Rows might be an array containing ResultSetHeader
    return (result.rows as any).insertId || (result.rows[0] as any).insertId;
}

export async function addQuestionToQuiz(data: {
    quizId: number;
    topicId?: number | null;
    questionText: string;
    points?: number;
    allowMultiple?: boolean;
    option1: string;
    option2: string;
    option3?: string | null;
    option4?: string | null;
    correctOptions: string;
}): Promise<void> {
    await db.query(
        `INSERT INTO quiz_question (id_quiz, id_topic, question_text, points, allow_multiple_selection, option_1, option_2, option_3, option_4, correct_options)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.quizId, data.topicId || null, data.questionText, data.points || 1, data.allowMultiple ? 1 : 0, data.option1, data.option2, data.option3 || null, data.option4 || null, data.correctOptions]
    );
}

export async function getQuizById(quizId: number): Promise<QuizRow | null> {
    const result = await db.query<QuizRow>(
        `SELECT * FROM quiz WHERE id_quiz = ?`,
        [quizId]
    );
    return result.rows[0] || null;
}

export async function getFullQuiz(quizId: number) {
    const quiz = await getQuizById(quizId);
    if (!quiz) return null;

    // Helper to get raw questions
    const qResult = await db.query<QuestionRow>(
        `SELECT * FROM quiz_question WHERE id_quiz = ?`,
        [quizId]
    );

    return {
        ...quiz,
        questions: qResult.rows
    };
}

export async function listQuizzesByProfessor(professorId: number) {
    const result = await db.query<QuizRow>(
        `SELECT * FROM quiz WHERE id_professor = ? ORDER BY created_at DESC`,
        [professorId]
    );
    return result.rows;
}

export async function listPublicQuizzes(limit = 20, offset = 0) {
    const result = await db.query<QuizRow>(
        `SELECT * FROM quiz WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );
    return result.rows;
}

export async function listQuizzesBySubject(subjectId: number) {
    const result = await db.query<QuizRow>(
        `SELECT * FROM quiz WHERE id_subject = ? AND is_public = 1 ORDER BY created_at DESC`,
        [subjectId]
    );
    return result.rows;
}

export async function deleteQuiz(quizId: number): Promise<boolean> {
    const result = await db.query<ResultSetHeader>(`DELETE FROM quiz WHERE id_quiz = ?`, [quizId]);
    return (result.rows as any).affectedRows > 0 || (result.rows[0] as any).affectedRows > 0;
}

export async function getQuizCountByProfessor(professorId: number): Promise<number> {
    const result = await db.query<RowDataPacket>(
        `SELECT COUNT(*) as count FROM quiz WHERE id_professor = ?`,
        [professorId]
    );
    return (result.rows[0] as any)?.count || 0;
}

export async function rateQuiz(quizId: number, userId: number, rating: number) {
    // Upsert rating
    await db.query(
        `INSERT INTO quiz_rating (id_quiz, id_user, rating) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
        [quizId, userId, rating]
    );

    // Update avg
    await db.query(`
        UPDATE quiz q 
        SET avg_rating = (SELECT AVG(rating) FROM quiz_rating WHERE id_quiz = q.id_quiz),
            rating_count = (SELECT COUNT(*) FROM quiz_rating WHERE id_quiz = q.id_quiz)
        WHERE id_quiz = ?
    `, [quizId]);

    return {}; // Return object to satisfy spread in routes
}

export async function incrementDownloads(quizId: number) {
    await db.query(`UPDATE quiz SET downloads = downloads + 1 WHERE id_quiz = ?`, [quizId]);
}

export async function copyQuizToLibrary(quizId: number, newProfessorId: number) {
    const original = await getFullQuiz(quizId);
    if (!original) throw new Error("Quiz not found");

    const newQuizId = await createQuiz({
        professorId: newProfessorId,
        subjectId: original.id_subject,
        name: original.quiz_name + " (Copy)",
        description: original.description || undefined,
        level: original.level,
        language: original.language || undefined
    });

    if (original.questions) {
        for (const q of (original as any).questions) {
            await addQuestionToQuiz({
                quizId: newQuizId,
                topicId: q.id_topic,
                questionText: q.question_text,
                points: Number(q.points),
                allowMultiple: Boolean(q.allow_multiple_selection),
                option1: q.option_1,
                option2: q.option_2,
                option3: q.option_3,
                option4: q.option_4,
                correctOptions: q.correct_options
            });
        }
    }

    return newQuizId;
}

// Get all student results for a specific quiz
export async function getQuizResults(quizId: number) {
    // Get quiz info
    const quizResult = await db.query<any>(
        `SELECT q.id_quiz, q.quiz_name, q.description, q.level,
                s.name_subject as subject_name, q.created_at
         FROM quiz q
         LEFT JOIN subject s ON s.id_subject = q.id_subject
         WHERE q.id_quiz = ?`,
        [quizId]
    );
    const quiz = quizResult.rows[0];
    if (!quiz) return null;

    // Get max score from questions
    const maxScoreResult = await db.query<any>(
        `SELECT COALESCE(SUM(points), 0) as max_score FROM quiz_question WHERE id_quiz = ?`,
        [quizId]
    );
    const maxScore = Number(maxScoreResult.rows[0]?.max_score) || 100;

    // Get all attempts with student info
    const attemptsResult = await db.query<any>(
        `SELECT qa.id_attempt, qa.id_student, qa.started_at, qa.finished_at,
                qa.total_score, qa.focus_lost_count,
                u.user_name, u.last_name, u.username
         FROM quiz_attempt qa
         JOIN user u ON u.id_user = qa.id_student
         WHERE qa.id_quiz = ?
         ORDER BY qa.total_score DESC`,
        [quizId]
    );

    const students = attemptsResult.rows.map((row: any) => ({
        studentId: row.id_student,
        studentName: `${row.user_name || ''} ${row.last_name || ''}`.trim() || row.username,
        score: Number(row.total_score) || 0,
        maxScore,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        focusLostCount: row.focus_lost_count || 0,
        attemptId: row.id_attempt,
    }));

    return {
        quiz: {
            id: quiz.id_quiz,
            title: quiz.quiz_name,
            subject: quiz.subject_name,
            date: quiz.created_at,
            maxScore,
        },
        results: students,
    };
}

// Get a specific student's detailed quiz responses
export async function getStudentQuizDetail(quizId: number, studentId: number) {
    // Get the attempt
    const attemptResult = await db.query<any>(
        `SELECT qa.* FROM quiz_attempt qa
         WHERE qa.id_quiz = ? AND qa.id_student = ?
         ORDER BY qa.finished_at DESC
         LIMIT 1`,
        [quizId, studentId]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) return null;

    // Get student info
    const studentResult = await db.query<any>(
        `SELECT user_name, last_name, username FROM user WHERE id_user = ?`,
        [studentId]
    );
    const student = studentResult.rows[0];

    // Get quiz info
    const quizResult = await db.query<any>(
        `SELECT q.quiz_name, s.name_subject as subject_name, q.created_at
         FROM quiz q
         LEFT JOIN subject s ON s.id_subject = q.id_subject
         WHERE q.id_quiz = ?`,
        [quizId]
    );
    const quiz = quizResult.rows[0];

    // Get max score
    const maxScoreResult = await db.query<any>(
        `SELECT COALESCE(SUM(points), 0) as max_score FROM quiz_question WHERE id_quiz = ?`,
        [quizId]
    );
    const maxScore = Number(maxScoreResult.rows[0]?.max_score) || 100;

    // Get responses with question details
    const responsesResult = await db.query<any>(
        `SELECT qr.id_response, qr.selected_options, qr.is_correct,
                qr.points_awarded, qr.time_taken_seconds,
                qq.id_question, qq.question_text, qq.points as max_points,
                qq.option_1, qq.option_2, qq.option_3, qq.option_4,
                qq.correct_options, qq.id_topic,
                t.name_topic as topic_name
         FROM quiz_response qr
         JOIN quiz_question qq ON qq.id_question = qr.id_question
         LEFT JOIN topic t ON t.id_topic = qq.id_topic
         WHERE qr.id_attempt = ?
         ORDER BY qq.id_question`,
        [attempt.id_attempt]
    );

    const questionResults = responsesResult.rows.map((r: any, idx: number) => {
        // Find the selected answer text
        const options = [r.option_1, r.option_2, r.option_3, r.option_4].filter(Boolean);
        let selectedAnswer = '';
        try {
            const selectedIndices = JSON.parse(r.selected_options || '[]');
            selectedAnswer = selectedIndices.map((i: number) => options[i - 1] || `Option ${i}`).join(', ');
        } catch {
            selectedAnswer = r.selected_options || '';
        }

        let correctAnswer = '';
        try {
            const correctIndices = JSON.parse(r.correct_options || '[]');
            correctAnswer = correctIndices.map((i: number) => options[i - 1] || `Option ${i}`).join(', ');
        } catch {
            correctAnswer = r.correct_options || '';
        }

        return {
            questionNumber: idx + 1,
            questionText: r.question_text,
            studentAnswer: selectedAnswer,
            correctAnswer,
            isCorrect: !!r.is_correct,
            points: Number(r.points_awarded) || 0,
            maxPoints: Number(r.max_points) || 1,
            timeTaken: Number(r.time_taken_seconds) || 0,
            topicName: r.topic_name || 'General',
        };
    });

    // Compute metrics from real data
    const totalQuestions = questionResults.length || 1;
    const correctCount = questionResults.filter((q: any) => q.isCorrect).length;
    const totalTime = questionResults.reduce((sum: number, q: any) => sum + q.timeTaken, 0);
    const avgTime = totalTime / totalQuestions;
    const pct = (Number(attempt.total_score) / maxScore) * 100;

    const metrics = {
        precision: Math.round((correctCount / totalQuestions) * 100),
        speed: Math.min(100, Math.round(Math.max(0, 100 - (avgTime - 20) * 1.5))),
        consistency: Math.round(pct),
        participation: 100, // they took the quiz
        comprehension: Math.round((correctCount / totalQuestions) * 100),
        effort: Math.min(100, Math.round(100 - (attempt.focus_lost_count || 0) * 10)),
    };

    return {
        studentId,
        studentName: `${student?.user_name || ''} ${student?.last_name || ''}`.trim() || student?.username || 'Unknown',
        score: Number(attempt.total_score) || 0,
        maxScore,
        quizTitle: quiz?.quiz_name || 'Quiz',
        quizSubject: quiz?.subject_name || '',
        quizDate: quiz?.created_at || '',
        submittedAt: attempt.finished_at,
        questionResults,
        metrics,
    };
}

// --- STUDENT QUIZ ATTEMPTS ---

export async function createQuizAttempt(data: {
    quizId: number;
    studentId: number;
    startedAt: string;
}): Promise<number> {
    const result = await db.query<ResultSetHeader>(
        `INSERT INTO quiz_attempt (id_quiz, id_student, started_at)
         VALUES (?, ?, ?)`,
        [data.quizId, data.studentId, data.startedAt]
    );
    return (result.rows as any).insertId || (result.rows[0] as any).insertId;
}

export async function saveQuizResponse(data: {
    attemptId: number;
    questionId: number;
    selectedOptions: string;
    isCorrect: boolean;
    pointsAwarded: number;
    timeTakenSeconds: number;
}): Promise<void> {
    await db.query(
        `INSERT INTO quiz_response (id_attempt, id_question, selected_options, is_correct, points_awarded, time_taken_seconds)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.attemptId, data.questionId, data.selectedOptions, data.isCorrect ? 1 : 0, data.pointsAwarded, data.timeTakenSeconds]
    );
}

export async function updateQuizAttemptScore(
    attemptId: number,
    totalScore: number,
    finishedAt: string,
    focusLostCount: number = 0
): Promise<void> {
    await db.query(
        `UPDATE quiz_attempt 
         SET total_score = ?, finished_at = ?, focus_lost_count = ?
         WHERE id_attempt = ?`,
        [totalScore, finishedAt, focusLostCount, attemptId]
    );
}

export async function getDetailedAnswers(quizId: number) {
    const result = await db.query<any>(
        `SELECT qq.id_question, qq.correct_options, qq.points, qq.id_topic, t.name as topic_name
         FROM quiz_question qq
         LEFT JOIN topic t ON t.id_topic = qq.id_topic
         WHERE qq.id_quiz = ?`,
        [quizId]
    );
    return result.rows;
}
