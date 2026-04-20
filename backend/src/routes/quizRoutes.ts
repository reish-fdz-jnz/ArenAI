import { Router } from 'express';
import { quizService } from '../services/quizService.js';

const router = Router();

// Create a new quiz with questions (full creation)
router.post('/', async (req, res, next) => {
    try {
        const { professorId, subjectId, name, description, level, language, questions } = req.body;

        if (!professorId || !subjectId || !name || !level || !questions || !Array.isArray(questions)) {
            res.status(400).json({ error: 'Missing required fields: professorId, subjectId, name, level, questions' });
            return;
        }

        const quizId = await quizService.createFullQuiz({
            professorId,
            subjectId,
            name,
            description,
            level,
            language,
            questions: questions.map((q: any) => ({
                topicId: q.topicId || null,
                topicName: q.topicName || q.topic || q.topic_name || null,
                questionText: q.questionText || q.question,
                points: q.points || 1,
                allowMultiple: q.allowMultiple || false,
                option1: q.option1 || q.options?.[0] || '',
                option2: q.option2 || q.options?.[1] || '',
                option3: q.option3 || q.options?.[2] || null,
                option4: q.option4 || q.options?.[3] || null,
                correctOptions: q.correctOptions || JSON.stringify([(q.correctIndex ?? 0) + 1]),
            })),
        });

        // Emit socket event so the UI can refresh immediately
        const io = req.app.get('io');
        if (io) {
            io.emit('quiz_created', { quizId, professorId, name });
        }

        res.status(201).json({ success: true, quizId });
    } catch (err) {
        next(err);
    }
});

// Get quizzes by professor
router.get('/professor/:professorId', async (req, res, next) => {
    try {
        const quizzes = await quizService.listQuizzesByProfessor(Number(req.params.professorId));
        res.json({ quizzes });
    } catch (err) {
        next(err);
    }
});

// Get public/popular quizzes (for community)
router.get('/public', async (req, res, next) => {
    try {
        const excludeUserId = req.query.excludeUser ? Number(req.query.excludeUser) : undefined;
        const quizzes = await quizService.listPublicQuizzes(excludeUserId);
        res.json({ quizzes });
    } catch (err) {
        next(err);
    }
});

// Get quizzes by subject
router.get('/subject/:subjectId', async (req, res, next) => {
    try {
        const quizzes = await quizService.listQuizzesBySubject(Number(req.params.subjectId));
        res.json({ quizzes });
    } catch (err) {
        next(err);
    }
});

// Get single quiz by ID
router.get('/:id', async (req, res, next) => {
    try {
        const quiz = await quizService.getQuizById(Number(req.params.id));
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        res.json(quiz);
    } catch (err) {
        next(err);
    }
});

// Get full quiz with questions
router.get('/:id/full', async (req, res, next) => {
    try {
        const quiz = await quizService.getFullQuiz(Number(req.params.id));
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        res.json({ quiz });
    } catch (err) {
        next(err);
    }
});

// Get questions for a quiz
router.get('/:id/questions', async (req, res, next) => {
    try {
        const questions = await quizService.getQuestions(Number(req.params.id));
        res.json(questions);
    } catch (err) {
        next(err);
    }
});

// Delete a quiz
router.delete('/:id', async (req, res, next) => {
    try {
        const deleted = await quizService.deleteQuiz(Number(req.params.id));
        if (!deleted) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Rate a quiz
router.post('/:id/rate', async (req, res, next) => {
    try {
        const quizId = Number(req.params.id);
        const { userId, rating } = req.body;

        if (!userId || !rating || rating < 1 || rating > 5) {
            res.status(400).json({ error: 'userId and rating (1-5) required' });
            return;
        }

        const result = await quizService.rateQuiz(quizId, userId, rating);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

// Copy quiz to user's library (download/add to my quizzes)
router.post('/:id/copy', async (req, res, next) => {
    try {
        const quizId = Number(req.params.id);
        const { userId } = req.body;

        if (!userId) {
            res.status(400).json({ error: 'userId required' });
            return;
        }

        const newQuizId = await quizService.copyQuizToLibrary(quizId, userId);
        if (!newQuizId) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }

        res.json({ success: true, newQuizId });
    } catch (err) {
        next(err);
    }
});
// Get quiz results (all student attempts for a quiz)
router.get('/:id/results', async (req, res, next) => {
    try {
        const data = await quizService.getQuizResults(Number(req.params.id));
        if (!data) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// Get student quiz detail (individual responses)
router.get('/:id/student/:studentId/detail', async (req, res, next) => {
    try {
        const data = await quizService.getStudentQuizDetail(
            Number(req.params.id),
            Number(req.params.studentId)
        );
        if (!data) {
            res.status(404).json({ error: 'No attempt found' });
            return;
        }
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// Submit a quiz attempt
router.post('/submit', async (req, res, next) => {
    try {
        const { studentId, quizId, classId, assignmentId, startedAt, finishedAt, focusLostCount, responses } = req.body;

        if (!studentId || !quizId || !startedAt || !finishedAt || !responses) {
            res.status(400).json({ error: 'Missing required fields for submission' });
            return;
        }

        const result = await quizService.submitQuizResult({
            studentId,
            quizId,
            classId,
            assignmentId,
            startedAt,
            finishedAt,
            focusLostCount,
            responses
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
