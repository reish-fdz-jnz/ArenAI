import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getActiveSessionForStudent,
  getSessionsByDateForStudent,
  getSessionHistoryForStudent,
  getStudentSessionDetail,
} from '../controllers/studentSessionController.js';

export const studentSessionRouter = Router();

// Retrieve all endpoints needing authentication
studentSessionRouter.use(requireAuth);

studentSessionRouter.get('/active', getActiveSessionForStudent);
studentSessionRouter.get('/by-date', getSessionsByDateForStudent);
studentSessionRouter.get('/history', getSessionHistoryForStudent);
studentSessionRouter.get('/:classId', getStudentSessionDetail);
