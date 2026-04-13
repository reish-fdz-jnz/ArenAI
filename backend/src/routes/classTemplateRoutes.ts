import { Router } from 'express';
import * as controller from '../controllers/classTemplateController.js';

const router = Router();

router.get('/', controller.listTemplates);
router.post('/', controller.createTemplate);
router.delete('/:id', controller.deleteTemplate);
router.post('/start-session', controller.startSession);

export const classTemplateRouter = router;
