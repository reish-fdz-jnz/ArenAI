import { Request, Response, NextFunction } from 'express';
import * as repo from '../repositories/classTemplateRepository.js';
import * as sessionRepo from '../repositories/classRepository.js';
import * as sectionRepo from '../repositories/sectionRepository.js';
import { ApiError } from '../middleware/errorHandler.js';
import { io } from '../server.js';
import { runFullInsightPipeline } from '../services/insightService.js';

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

    const { templateId, sectionId, institutionId, name_session, grade } = req.body;

    if (!sectionId) {
      throw new ApiError(400, 'Missing sectionId');
    }

    // Resolve the internal DB id_section if institutional context is provided
    // because professors send "Section Number" (e.g., 1) but students join via "Global ID"
    let resolvedSectionId = sectionId;
    if (institutionId && grade) {
        const section = await sectionRepo.findSectionByGradeAndNumber(String(grade), String(sectionId), institutionId);
        if (section) {
            resolvedSectionId = section.id_section;
            console.log(`[Session] Resolved Section ${sectionId} (Grade ${grade}) to Global ID ${resolvedSectionId}`);
        }
    }

    const session = await sessionRepo.createClass({
      name_session,
      templateId,
      sectionId: resolvedSectionId,
      professorId,
      institutionId,
      status: 'running'
    });
    
    // Emit real-time notification to the section room using the RESOLVED ID
    if (io) {
      io.to(`section_${resolvedSectionId}`).emit('class_started', {
        classId: session.id_class,
        name_session: session.name_session,
        sectionId: resolvedSectionId
      });
      console.log(`[Socket] Broadcasted class_started to section_${resolvedSectionId}`);
    }

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
      status: 'running',
      sectionId: finalSectionId || undefined,
    });

    if (classes.length === 0) {
      res.json(null);
      return;
    }

    // Since listClasses orders by start_time DESC, classes[0] is the newest running session
    const activeSession = classes[0];
    
    // Safety check: verify it belongs to the professor (already filtered in listClasses but good to be explicit)
    if (activeSession.id_professor !== professorId) {
       res.json(null);
       return;
    }
    const topics = await repo.listTopicsByTemplate(activeSession.id_class_template);

    res.json({
      ...activeSession,
      topics,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const institutionId = req.user?.id_institution;
    const grade = req.query.grade as string;
    const sectionNumber = req.query.sectionNumber as string;

    if (!professorId) throw new ApiError(401, 'Unauthorized');

    let finalSectionId = req.query.sectionId ? parseInt(req.query.sectionId as string, 10) : null;

    if (grade && sectionNumber && institutionId) {
      const section = await sectionRepo.findSectionByGradeAndNumber(grade, sectionNumber, institutionId);
      if (section) finalSectionId = section.id_section;
    }

    const classes = await sessionRepo.listClasses({
      professorId,
      sectionId: finalSectionId || undefined,
    });

    const timezoneOffset = parseInt(req.query.timezoneOffset as string, 10) || 0;

    // Format output: { "2026-04-15": 2, "2026-04-16": 1 }
    const dateCounts: Record<string, number> = {};
    for (const c of classes) {
      if (c.start_time) {
        // Adjust timestamp by offset to group by the professor's local day
        const d = new Date(c.start_time);
        const localTime = new Date(d.getTime() - (timezoneOffset * 60 * 1000));
        const dateStr = localTime.toISOString().split('T')[0];
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
      }
    }

    res.json(dateCounts);
  } catch (error) {
    next(error);
  }
}

export async function getSessionByDate(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const institutionId = req.user?.id_institution;
    const dateQuery = req.query.date as string;
    const grade = req.query.grade as string;
    const sectionNumber = req.query.sectionNumber as string;

    if (!professorId) throw new ApiError(401, 'Unauthorized');
    if (!dateQuery) throw new ApiError(400, 'Missing date parameter');

    let finalSectionId = req.query.sectionId ? parseInt(req.query.sectionId as string, 10) : null;

    if (grade && sectionNumber && institutionId) {
      const section = await sectionRepo.findSectionByGradeAndNumber(grade, sectionNumber, institutionId);
      if (section) finalSectionId = section.id_section;
    }

    const timezoneOffset = parseInt(req.query.timezoneOffset as string, 10) || 0;

    // Calculate UTC range for the selected local date
    // If local date is 2026-04-15 and offset is 360 (UTC-6)
    // Local range: 2026-04-15 00:00:00 to 2026-04-15 23:59:59
    // UTC range: 2026-04-15 06:00:00 to 2026-04-16 05:59:59
    const startOfLocalDay = new Date(`${dateQuery}T00:00:00Z`);
    const endOfLocalDay = new Date(`${dateQuery}T23:59:59Z`);
    
    // Shift to UTC by adding the offset (in minutes)
    const startDateUTC = new Date(startOfLocalDay.getTime() + (timezoneOffset * 60 * 1000)).toISOString();
    const endDateUTC = new Date(endOfLocalDay.getTime() + (timezoneOffset * 60 * 1000)).toISOString();

    const classes = await sessionRepo.listClasses({
      professorId,
      sectionId: finalSectionId || undefined,
      startDate: startDateUTC,
      endDate: endDateUTC
    });

    const populatedClasses = await Promise.all(classes.map(async (c) => {
      const topics = await repo.listTopicsByTemplate(c.id_class_template);
      return { ...c, topics };
    }));

    res.json(populatedClasses);
  } catch (error) {
    next(error);
  }
}

export async function endSession(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { id } = req.params;
    if (!professorId) throw new ApiError(401, 'Unauthorized');

    const classId = parseInt(id, 10);
    const classRecord = await sessionRepo.getClassById(classId);

    await sessionRepo.updateClassStatus(classId, 'finished', true);
    
    // Emit real-time notification to the section room
    if (io && classRecord) {
      io.to(`section_${classRecord.id_section}`).emit('class_finished', {
        classId,
        sectionId: classRecord.id_section
      });
      console.log(`[Socket] Broadcasted class_finished to section_${classRecord.id_section}`);
      
      // Trigger final AI insight pipeline (non-blocking)
      runFullInsightPipeline(classId).catch(err => {
        console.error(`[AI Trigger] Failed final pipeline for class ${classId}:`, err);
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function renameSession(req: Request, res: Response, next: NextFunction) {
  try {
    const professorId = req.user?.id;
    const { id } = req.params;
    const { name_session } = req.body;
    
    if (!professorId) throw new ApiError(401, 'Unauthorized');
    if (!name_session) throw new ApiError(400, 'Missing name_session');

    await sessionRepo.updateClassName(parseInt(id, 10), name_session);
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
