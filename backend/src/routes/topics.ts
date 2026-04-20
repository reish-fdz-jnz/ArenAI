import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler.js';
import { getTopicById, getTopicRelations, createTopicRelation, createTopicResource, listTopicResources } from '../repositories/topicRepository.js';
import { getStudentTopicMastery, getTopicSessionHistory } from '../repositories/studentRepository.js';
import { findSectionByGradeAndNumber, getSectionTopicMastery, getSectionTopicHistory } from '../repositories/sectionRepository.js';
import { findUserByUsername } from '../repositories/userRepository.js';
import { requireAuth } from '../middleware/auth.js';
// import { generateTopicMasteryInsight } from '../services/insightService.js';
import { db } from '../db/pool.js';


const router = Router();

router.post('/relations', async (req, res, next) => {
  const bodySchema = z.object({
    fatherId: z.number().int().positive(),
    sonId: z.number().int().positive(),
    correlation: z.number().min(0).max(1).optional(),
  });

  try {
    const body = bodySchema.parse(req.body);

    if (body.fatherId === body.sonId) {
      throw new ApiError(400, 'fatherId and sonId must be different');
    }

    const relation = await createTopicRelation(body);
    res.status(201).json(relation);
  } catch (error) {
    next(error);
  }
});

router.get('/:topicId', requireAuth, async (req, res, next) => {
  const paramsSchema = z.object({ topicId: z.coerce.number().int().positive() });

  try {
    const { topicId } = paramsSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    // 1. Fetch Basic Topic Info
    const topic = await getTopicById(topicId);
    if (!topic) {
      throw new ApiError(404, 'Topic not found');
    }

    // 2. Fetch Permanent Mastery Profile
    const mastery = await getStudentTopicMastery(userId, topicId);

    // 3. Fetch Relations (Optional)
    let relations: any[] = [];
    try {
      relations = await getTopicRelations(topicId, userId);
    } catch (e) {
      console.warn(`[TopicDetail] Error fetching relations for topic ${topicId}:`, e);
    }

    // 4. Fetch Session History (Optional)
    let history: any[] = [];
    try {
      history = await getTopicSessionHistory(userId, topicId);
    } catch (e) {
      console.warn(`[TopicDetail] Error fetching session history for topic ${topicId}:`, e);
    }

    /* 
    if (!mastery.ai_summary && history.length > 0) {
      generateTopicMasteryInsight(userId, topicId).catch(err => {
        console.error(`[TopicDetail] Background analysis error:`, err);
      });
    }
    */

    // Combine result
    res.json({
      id_topic: topic.id_topic,
      name: topic.name,
      description: topic.description,
      subject_name: topic.subject_name,
      permanent_score: mastery.score || 0,
      ai_summary: mastery.ai_summary,
      relations: relations,
      history: history
    });

  } catch (error) {
    next(error);
  }
});

router.get('/:topicId/resources', async (req, res, next) => {
  const paramsSchema = z.object({ topicId: z.coerce.number().int().positive() });

  try {
    const { topicId } = paramsSchema.parse(req.params);
    const resources = await listTopicResources(topicId);
    res.json(resources);
  } catch (error) {
    next(error);
  }
});

router.post('/:topicId/resources', async (req, res, next) => {
  const paramsSchema = z.object({ topicId: z.coerce.number().int().positive() });
  const bodySchema = z.object({
    source: z.string().url(),
    description: z.string().optional(),
    quality: z.number().min(0).max(100).optional(),
  });

  try {
    const { topicId } = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);
    const resource = await createTopicResource({
      topicId,
      source: body.source,
      description: body.description,
      quality: body.quality ?? null,
    });

    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
});

router.get('/class/:topicId', requireAuth, async (req, res, next) => {
  const paramsSchema = z.object({ topicId: z.coerce.number().int().positive() });
  const querySchema = z.object({
    grade: z.string(),
    sectionNumber: z.string(),
    classId: z.coerce.number().int().positive().optional()
  });

  try {
    const { topicId } = paramsSchema.parse(req.params);
    const { grade, sectionNumber, classId } = querySchema.parse(req.query);
    const userRole = req.user?.role;
    const username = req.user?.username;

    if (userRole !== 'professor') {
      throw new ApiError(403, 'Only professors can access class-level topic data');
    }

    if (!username) throw new ApiError(401, 'Unauthorized');
    const dbUser = await findUserByUsername(username);
    if (!dbUser || !dbUser.id_institution) throw new ApiError(404, 'Institution not found');

    const section = await findSectionByGradeAndNumber(grade, sectionNumber, dbUser.id_institution);
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    const sectionId = section.id_section;

    // 1. Fetch Basic Topic Info
    const topic = await getTopicById(topicId);
    if (!topic) {
      throw new ApiError(404, 'Topic not found');
    }

    // 2. Fetch Permanent Section Mastery
    const mastery = await getSectionTopicMastery(sectionId, topicId);

    // 2b. Fetch Session Specific Score if classId provided
    let sessionScore = null;
    if (classId) {
      const sessionResult = await db.query<any>(
        `SELECT score_average FROM class_topic WHERE id_class = ? AND id_topic = ?`,
        [classId, topicId]
      );
      if (sessionResult.rows.length > 0) {
        sessionScore = sessionResult.rows[0].score_average;
      }
    }

    // 3. Fetch Relations
    let relations: any[] = [];
    try {
      relations = await getTopicRelations(topicId); // Pass only topicId as userId is optional for professors
    } catch (e) {
      console.warn(`[ClassTopicDetail] Error fetching relations for topic ${topicId}:`, e);
    }

    // 4. Fetch Section History
    let history: any[] = [];
    try {
      history = await getSectionTopicHistory(sectionId, topicId);
    } catch (e) {
      console.warn(`[ClassTopicDetail] Error fetching session history for topic ${topicId}:`, e);
    }

    // Combine result - 1-to-1 with student version structure
    res.json({
      id_topic: topic.id_topic,
      name: topic.name,
      description: topic.description,
      subject_name: topic.subject_name,
      permanent_score: mastery.score || 0,
      session_score: sessionScore,
      ai_summary: mastery.ai_summary,
      relations: relations,
      history: history
    });

  } catch (error) {
    next(error);
  }
});


export const topicsRouter = router;
