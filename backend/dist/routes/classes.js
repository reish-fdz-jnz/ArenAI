import { Router } from 'express';
import { z } from 'zod';
import { createClass, listClasses, recordClassTopics, recordClassStudents, recordClassStudentTopics } from '../repositories/classRepository.js';
const router = Router();
router.get('/', async (req, res, next) => {
    const querySchema = z.object({
        sectionId: z.coerce.number().int().positive().optional(),
        professorId: z.coerce.number().int().positive().optional(),
        status: z.string().optional()
    });
    try {
        const filters = querySchema.parse(req.query);
        const classes = await listClasses(filters);
        res.json(classes);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    const schema = z.object({
        professorId: z.number().int().positive(),
        templateId: z.number().int().positive().optional().nullable(),
        sectionId: z.number().int().positive(),
        institutionId: z.number().int().positive().optional().nullable(),
        status: z.string().optional()
    });
    try {
        const body = schema.parse(req.body);
        const classRecord = await createClass({
            templateId: body.templateId,
            sectionId: body.sectionId,
            professorId: body.professorId,
            institutionId: body.institutionId,
            status: body.status
        });
        res.status(201).json(classRecord);
    }
    catch (error) {
        next(error);
    }
});
router.post('/:classId/topics', async (req, res, next) => {
    const paramsSchema = z.object({ classId: z.coerce.number().int().positive() });
    const bodySchema = z.object({
        topics: z.array(z.object({
            topicId: z.number().int().positive(),
            scoreAverage: z.number().min(0).max(100).optional(),
            aiSummary: z.string().optional()
        })).min(1),
    });
    try {
        const { classId } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        await recordClassTopics(classId, body.topics);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.post('/:classId/students', async (req, res, next) => {
    const paramsSchema = z.object({ classId: z.coerce.number().int().positive() });
    const bodySchema = z.object({
        students: z.array(z.object({
            userId: z.number().int().positive(),
            scoreAverage: z.number().min(0).max(100).optional(),
            aiSummary: z.string().optional(),
            attendance: z.boolean().optional()
        })).min(1),
    });
    try {
        const { classId } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        await recordClassStudents(classId, body.students);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.post('/:classId/topics/scores', async (req, res, next) => {
    const paramsSchema = z.object({ classId: z.coerce.number().int().positive() });
    const bodySchema = z.object({
        entries: z.array(z.object({
            userId: z.number().int().positive(),
            topicId: z.number().int().positive(),
            score: z.number().min(0).max(100).optional(),
            aiSummary: z.string().optional()
        })).min(1),
    });
    try {
        const { classId } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        await recordClassStudentTopics(classId, body.entries);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export const classesRouter = router;
