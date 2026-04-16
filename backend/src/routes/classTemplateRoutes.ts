import { Router } from 'express';
import * as controller from '../controllers/classTemplateController.js';

const router = Router();

router.get('/', controller.listTemplates);
router.post('/', controller.createTemplate);
router.delete('/:id', controller.deleteTemplate);
router.post('/start-session', controller.startSession);
router.get('/active', controller.getActiveSession);
router.get('/history', controller.getSessionHistory);
router.get('/by-date', controller.getSessionByDate);
router.post('/end/:id', controller.endSession);
router.patch('/rename/:id', controller.renameSession);
router.post('/attendance/:classId', controller.syncAttendance);
router.get('/attendance/:classId', controller.getAttendance);

export const classTemplateRouter = router;
