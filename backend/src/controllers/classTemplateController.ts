import { Request, Response, NextFunction } from 'express';
import * as repo from '../repositories/classTemplateRepository.js';
import * as sessionRepo from '../repositories/classRepository.js';
import * as sectionRepo from '../repositories/sectionRepository.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    if (!professorId) throw new ApiError(401, 'Unauthorized');
    
    const templates = await repo.listTemplatesByProfessor(professorId);
    res.json(templates);
  } catch (error) {
    next(error);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { id } = req.params;
    
    if (!professorId) throw new ApiError(401, 'Unauthorized');

    const success = await repo.deleteTemplate(parseInt(id, 10), professorId);
    if (!success) throw new ApiError(404, 'Template not found');

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function startSession(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    if (!professorId) throw new ApiError(401, 'Unauthorized');

    const { templateId, sectionId, institutionId, name_session } = req.body;

    if (!sectionId) {
      throw new ApiError(400, 'Missing sectionId');
    }

    const session = await sessionRepo.createClass({
      name_session,
      templateId,
      sectionId,
      professorId,
      institutionId,
      status: 'running'
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

export async function getActiveSession(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const institutionId = req.user?.id_institution;
    const sectionIdQuery = req.query.sectionId ? parseInt(req.query.sectionId as string, 10) : null;
    const grade = req.query.grade as string;
    const sectionNumber = req.query.sectionNumber as string;

    if (!professorId) throw new ApiError(401, 'Unauthorized');

    let finalSectionId = sectionIdQuery;

    // Resolve labels to ID if needed
    if (grade && sectionNumber && institutionId) {
      const section = await sectionRepo.findSectionByGradeAndNumber(grade, sectionNumber, institutionId);
      if (section) {
        finalSectionId = section.id_section;
      }
    }

    const classes = await sessionRepo.listClasses({
      professorId,
      status: 'started',
      id_section: finalSectionId || undefined,
    });

    if (classes.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const activeSession = classes[0];
    const topics = await classTemplateRepo.listTopicsByTemplate(activeSession.id_class_template);

    res.json({
      success: true,
      data: {
        ...activeSession,
        topics,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function endSession(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { id } = req.params;
    if (!professorId) throw new ApiError(401, 'Unauthorized');

    await sessionRepo.updateClassStatus(parseInt(id, 10), 'finished', true);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function syncAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { classId } = req.params;
    const { students } = req.body; // Array of { userId, attendance }

    if (!professorId) throw new ApiError(401, 'Unauthorized');
    if (!Array.isArray(students)) throw new ApiError(400, 'Invalid students data');

    await sessionRepo.recordClassStudents(parseInt(classId, 10), students);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { classId } = req.params;
    if (!professorId) throw new ApiError(401, 'Unauthorized');

    const attendance = await sessionRepo.listAttendance(parseInt(classId, 10));
    res.json(attendance);
  } catch (error) {
    next(error);
  }
}
