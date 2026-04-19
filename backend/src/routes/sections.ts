import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler.js';
import { 
  createSection, 
  getSectionById, 
  listSectionsByInstitution, 
  listAllSections, 
  findSectionByGradeAndNumber, 
  getSectionTopicProgress 
} from '../repositories/sectionRepository.js';
import { listStudentsBySection } from '../repositories/studentRepository.js';
import { findUserByUsername } from '../repositories/userRepository.js';
import { parseNumeric } from '../utils/transformers.js';

const router = Router();

// GET /api/sections/institution - get sections for current user's institution
router.get('/institution', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Fetch user from DB to get id_institution
    const dbUser = await findUserByUsername(user.username);
    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }
    
    let sections;
    if (dbUser.id_institution) {
      // User has institution - get sections for that institution
      sections = await listSectionsByInstitution(dbUser.id_institution);
    } else {
      // User has no institution - get all sections as fallback
      console.log('User has no institution, returning all sections');
      sections = await listAllSections();
    }
    
    console.log(`Returning ${sections.length} sections`);
    
    res.json({
      sections: sections.map(s => ({
        id: s.id_section,
        sectionNumber: s.section_number,
        grade: s.grade,
        name: `${s.grade}-${s.section_number}`,
      }))
    });
  } catch (error) {
    console.error('Error in GET /api/sections/institution:', error);
    next(error);
  }
});

// POST /api/sections - create a new section (teacher only)
router.post('/', async (req, res, next) => {
  // Section number (string) and grade (string)
  const bodySchema = z.object({
    section_number: z.string().min(1, 'Section number is required'),
    grade: z.string().min(1, 'Grade is required'),
  });
  try {
    const { section_number, grade } = bodySchema.parse(req.body);

    // Get teacher's institution from auth middleware
    const user = req.user;
    if (!user || !user.id) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Fetch user from DB to get id_institution
    const dbUser = await findUserByUsername(user.username);
    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }
    if (!dbUser.id_institution) {
      throw new ApiError(400, 'User does not have an institution');
    }

    let section;
    try {
      section = await createSection({ sectionNumber: section_number, grade, institutionId: dbUser.id_institution });
    } catch (dbErr: any) {
      // Handle duplicate section (unique constraint on id_institution, name)
      if (dbErr?.code === 'ER_DUP_ENTRY' || (dbErr?.message && dbErr.message.includes('Duplicate'))) {
        throw new ApiError(409, 'Section with this number already exists for your institution');
      }
      // rethrow otherwise
      throw dbErr;
    }

    res.status(201).json(section);
  } catch (error) {
    // log for debugging then forward to global error handler
    console.error('Error in POST /api/sections:', error);
    next(error);
  }
});

router.get('/:sectionId/students', async (req, res, next) => {
  const paramsSchema = z.object({ sectionId: z.coerce.number().int().positive() });

  try {
    const { sectionId } = paramsSchema.parse(req.params);

    const section = await getSectionById(sectionId);
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    const students = await listStudentsBySection(sectionId);

    res.json(
      students.map((student) => ({
        id: student.id_user,
        username: student.username,
        name: student.name,
        lastName: student.last_name,
        email: student.email,
        phoneNumber: student.phone_number,
        guardianEmail: student.email_guardian,
        scoreAverage: parseNumeric(student.score_average),
        roleInSection: student.role_in_section,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/join', async (req, res, next) => {
  // Section number (string) and grade (string)
  const bodySchema = z.object({
    section_number: z.string().min(1, 'Section number is required'),
    grade: z.string().min(1, 'Grade is required'),
  });
  try {
    const { section_number, grade } = bodySchema.parse(req.body);

    // Get teacher's institution from auth middleware
    const user = req.user;
    if (!user || !user.id) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Fetch user from DB to get id_institution
    const dbUser = await findUserByUsername(user.username);
    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }
    if (!dbUser.id_institution) {
      throw new ApiError(400, 'User does not have an institution');
    }

    let section;
    try {
      section = await createSection({ sectionNumber: section_number, grade, institutionId: dbUser.id_institution });
    } catch (dbErr: any) {
      // Handle duplicate section (unique constraint on id_institution, name)
      if (dbErr?.code === 'ER_DUP_ENTRY' || (dbErr?.message && dbErr.message.includes('Duplicate'))) {
        throw new ApiError(409, 'Section with this number already exists for your institution');
      }
      // rethrow otherwise
      throw dbErr;
    }

    res.status(201).json(section);
  } catch (error) {
    // log for debugging then forward to global error handler
    console.error('Error in POST /api/sections:', error);
    next(error);
  }
});


// ... (rest of router code)

router.get('/progress', async (req, res, next) => {
  try {
    const { grade, sectionNumber, subject, classId } = req.query;
    const user = req.user;

    if (!grade || !sectionNumber || !subject) {
      throw new ApiError(400, 'Missing grade, sectionNumber, or subject query parameter');
    }

    if (!user) throw new ApiError(401, 'Unauthorized');
    const dbUser = await findUserByUsername(user.username);
    if (!dbUser || !dbUser.id_institution) throw new ApiError(404, 'Institution not found');

    const section = await findSectionByGradeAndNumber(String(grade), String(sectionNumber), dbUser.id_institution);
    if (!section) {
       return res.json([]); // No section found, return empty progress
    }

    const progress = await getSectionTopicProgress(
      section.id_section, 
      String(subject), 
      classId ? Number(classId) : undefined
    );
    
    res.json(progress.map(p => ({
      id_topic: p.id_topic,
      name: p.name_topic,
      score: parseNumeric(p.score),
      ai_summary: p.ai_summary
    })));
  } catch (error) {
    next(error);
  }
});

export const sectionsRouter = router;
