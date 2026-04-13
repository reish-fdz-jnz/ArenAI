import express from 'express';
import { getDiagnosticReport } from '../controllers/diagnosticController.js';

const router = express.Router();

// GET /api/diagnostics/:studentId/:topicId/:classId/:subjectId
router.get('/:studentId/:topicId/:classId/:subjectId', getDiagnosticReport);

export default router;
