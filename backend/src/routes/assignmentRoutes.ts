import { Router } from 'express';
import { assignmentService } from '../services/assignmentService.js';

const router = Router();

// Create a new assignment
router.post('/', async (req, res, next) => {
    try {
        console.log('POST /api/assignments - Body:', JSON.stringify(req.body));
        const { title, description, sectionId, professorId, subjectId, dueTime, quizId, winBattleRequirement, minBattleWins } = req.body;

        if (!professorId || !sectionId || !subjectId) {
            console.log('Missing required fields:', { professorId, sectionId, subjectId });
            res.status(400).json({ error: 'professorId, sectionId, and subjectId are required' });
            return;
        }

        const id = await assignmentService.createAssignment({
            title,
            description,
            sectionId,
            professorId,
            subjectId,
            dueTime,
            quizId,
            winBattleRequirement,
            minBattleWins,
        });

        // NOTIFY STUDENTS IN THE SECTION
        // We broadcast to the section room so all students in that class get a real-time alert
        const { io } = await import('../server.js');
        if (io) {
            io.to(`section_${sectionId}`).emit('new_assignment', {
                id,
                title: title || 'Nueva Tarea',
                description,
                quizId
            });
            console.log(`[Socket] Broadcasted new_assignment to section_${sectionId}`);
        }

        console.log('Assignment created with ID:', id);
        res.status(201).json({ success: true, id });
    } catch (err: any) {
        console.error('Error creating assignment:', err.message, err.stack);
        next(err);
    }
});

// Get assignments by professor (MUST be before /:id to avoid matching "professor" as an id)
router.get('/professor/:professorId', async (req, res, next) => {
    try {
        console.log('GET /api/assignments/professor/', req.params.professorId);
        const assignments = await assignmentService.listByProfessor(Number(req.params.professorId));
        res.json({ assignments });
    } catch (err: any) {
        console.error('Error listing assignments:', err.message);
        next(err);
    }
});

// Get assignments by section (MUST be before /:id)
router.get('/section/:sectionId', async (req, res, next) => {
    try {
        const assignments = await assignmentService.listBySection(Number(req.params.sectionId));
        res.json(assignments);
    } catch (err) {
        next(err);
    }
});

// Get student assignments (MUST be before /:id)
router.get('/student/:studentId', async (req, res, next) => {
    try {
        const assignments = await assignmentService.getStudentAssignments(Number(req.params.studentId));
        res.json(assignments);
    } catch (err) {
        next(err);
    }
});

// Get single assignment by ID (MUST be AFTER all named routes)
router.get('/:id/submissions', async (req, res, next) => {
    try {
        const data = await assignmentService.getAssignmentSubmissions(Number(req.params.id));
        if (!data) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const assignment = await assignmentService.getAssignmentById(Number(req.params.id));
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        res.json(assignment);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const assignmentId = Number(req.params.id);
        await assignmentService.deleteAssignment(assignmentId);
        res.json({ success: true, message: 'Assignment deleted' });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const assignmentId = Number(req.params.id);
        const { title, description, sectionId, professorId, subjectId, dueTime, quizId, winBattleRequirement, minBattleWins } = req.body;

        await assignmentService.updateAssignment(assignmentId, {
            title,
            description,
            sectionId,
            professorId,
            subjectId,
            dueTime,
            quizId,
            winBattleRequirement,
            minBattleWins,
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/assign', async (req, res, next) => {
    try {
        const { studentId } = req.body;
        const id = await assignmentService.assignToStudent(Number(req.params.id), studentId);
        res.status(201).json({ id });
    } catch (err) {
        next(err);
    }
});

router.patch('/student/:assignmentStudentId/complete', async (req, res, next) => {
    try {
        const { complete } = req.body;
        const status = complete ? 'SUBMITTED' : 'IN_PROGRESS';
        await assignmentService.updateStatus(Number(req.params.assignmentStudentId), status);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;

