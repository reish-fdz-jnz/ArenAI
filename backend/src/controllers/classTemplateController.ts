import { Request, Response } from 'express';
import * as repo from '../repositories/classTemplateRepository.js';
import * as sessionRepo from '../repositories/classRepository.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function listTemplates(req: Request, res: Response) {
  const professorId = req.user?.id;
  if (!professorId) throw new ApiError(401, 'Unauthorized');
  
  const templates = await repo.listTemplatesByProfessor(professorId);
  res.json(templates);
}

export async function createTemplate(req: Request, res: Response) {
  const professorId = req.user?.id;
  if (!professorId) throw new ApiError(401, 'Unauthorized');

  const { subjectId, name, grade, description, settings, topicIds } = req.body;

  if (!subjectId || !name || !grade || !Array.isArray(topicIds)) {
    throw new ApiError(400, 'Missing required fields');
  }

  const templateId = await repo.createTemplate({
    professorId,
    subjectId,
    name,
    grade,
    description,
    settings,
    topicIds
  });

  const created = await repo.getTemplateById(templateId);
  res.status(201).json(created);
}

export async function deleteTemplate(req: Request, res: Response) {
  const professorId = req.user?.id;
  const { id } = req.params;
  
  if (!professorId) throw new ApiError(401, 'Unauthorized');

  const success = await repo.deleteTemplate(parseInt(id, 10), professorId);
  if (!success) throw new ApiError(404, 'Template not found');

  res.status(204).send();
}

export async function startSession(req: Request, res: Response) {
  const professorId = req.user?.id;
  if (!professorId) throw new ApiError(401, 'Unauthorized');

  const { templateId, sectionId, institutionId } = req.body;

  if (!sectionId) {
    throw new ApiError(400, 'Missing sectionId');
  }

  const session = await sessionRepo.createClass({
    templateId,
    sectionId,
    professorId,
    institutionId,
    status: 'running'
  });

  res.status(201).json(session);
}
