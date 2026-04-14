import { Router } from 'express';
import { z } from 'zod';
import { findUserByIdentifier, findUserByUsername, createUser, linkUserToSection } from '../repositories/userRepository.js';
import { ApiError } from '../middleware/errorHandler.js';
import { signAccessToken, verifyPassword, hashPassword } from '../services/authService.js';
import { createInstitution, findInstitutionByName } from '../repositories/institutionRepository.js';
import { getSectionById, findSectionByNumberAndInstitution, findSectionByGradeAndNumber } from '../repositories/sectionRepository.js';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  institution: z.string().optional(),
  password: z.string().min(8),
});

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    const matchesPlain = !isValid && user.password_hash === password;

    if (!isValid && !matchesPlain) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const { token, expiresIn } = signAccessToken({
      userId: user.id_user,
      username: user.username,
      role: user.role,
      idInstitution: user.id_institution,
    });

    res.json({
      token,
      expiresIn,
      user: {
        id: user.id_user,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        lastName: user.last_name,
        first_login: user.first_login,
        profilePicture: user.profile_picture_name,
        institution: user.id_institution
          ? {
            id: user.id_institution,
            name: user.institution_name,
          }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;

// Register route for professors
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    // Generate base username from firstName + lastName
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();

    const base = normalize(body.firstName + body.lastName);

    let username = base || 'user';
    let counter = 1;
    while (await findUserByUsername(username)) {
      username = `${base}${counter}`;
      counter += 1;
    }

    // Resolve institution id: try to find by name, else create
    let idInstitution: number | null = null;
    if (body.institution && body.institution.trim()) {
      const instResult = await findInstitutionByName(body.institution.trim());
      if (instResult) {
        idInstitution = instResult.id_institution;
      } else {
        const created = await createInstitution({ name: body.institution.trim() });
        idInstitution = created.id_institution;
      }
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create user with role 'professor'
    const created = await createUser({
      username,
      email: body.email,
      passwordHash,
      name: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber ?? null,
      idInstitution: idInstitution ?? null,
      role: 'professor',
    });

    if (!created) throw new ApiError(500, 'Failed to create user');

    const { token, expiresIn } = signAccessToken({
      userId: created.id_user,
      username: created.username,
      role: created.role,
      idInstitution: created.id_institution,
    });

    res.status(201).json({
      token,
      expiresIn,
      user: {
        id: created.id_user,
        username: created.username,
        email: created.email,
        role: created.role,
        name: created.name,
        lastName: created.last_name,
        first_login: created.first_login,
        profilePicture: created.profile_picture_name,
        institution: created.id_institution
          ? { id: created.id_institution, name: created.institution_name }
          : null,
      },
    });
  } catch (error: any) {
    // Handle unique constraint collisions
    if (error?.message?.includes('Duplicate') || (error?.code && (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_DUP_KEY'))) {
      next(new ApiError(409, 'User with given email or username already exists'));
      return;
    }
    next(error);
  }
});

// Register student endpoint (public)
router.post('/register-student', async (req, res, next) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(6),
    institution: z.string().min(1),
    sectionId: z.number().int().positive().optional(),
    sectionNumber: z.string().min(1).optional(),
  }).refine(data => data.sectionId || data.sectionNumber, {
    message: 'Either sectionId or sectionNumber is required',
  });

  try {
    const body = schema.parse(req.body);

    // ensure username not taken
    if (await findUserByUsername(body.username)) {
      throw new ApiError(409, 'Username already taken');
    }

    // Resolve or create institution
    let idInstitution: number | null = null;
    const instResult = await findInstitutionByName(body.institution.trim());
    if (instResult) {
      idInstitution = instResult.id_institution;
    } else {
      const createdInst = await createInstitution({ name: body.institution.trim() });
      idInstitution = createdInst.id_institution;
    }

    // Verify section exists and belongs to institution
    if (!idInstitution) throw new ApiError(400, 'Institution not found');
    
    let secRow: any = null;

    if (body.sectionId) {
      // Legacy: resolve by direct ID
      secRow = await getSectionById(body.sectionId);
      if (!secRow) {
        throw new ApiError(404, 'Section not found');
      }
    } else if (body.sectionNumber) {
      // Parse "7-1" into grade="7" and section_number="1"
      const parts = body.sectionNumber.split('-');
      if (parts.length !== 2) {
        throw new ApiError(400, 'Section format must be "grade-section" (e.g. "7-1")');
      }
      const [grade, sectionNum] = parts;
      // Query by grade + section_number + institution
      secRow = await findSectionByGradeAndNumber(grade, sectionNum, idInstitution);
      if (!secRow) {
        throw new ApiError(404, `Section "${body.sectionNumber}" not found at this institution`);
      }
    }

    if (!secRow) {
      throw new ApiError(400, 'Section could not be resolved');
    }

    if (secRow.id_institution !== idInstitution) {
      throw new ApiError(400, 'Section does not belong to the institution'); 
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Because email and name are required in DB, synthesize minimal values
    const syntheticEmail = `${body.username}@students.arenai`;

    const created = await createUser({
      username: body.username,
      email: syntheticEmail,
      passwordHash,
      name: body.username,
      lastName: null,
      phoneNumber: null,
      idInstitution: idInstitution,
      role: 'student',
    });

    if (!created) throw new ApiError(500, 'Failed to create student user');

    // Link to section
    await linkUserToSection(created.id_user, secRow.id_section, 'student');

    const { token, expiresIn } = signAccessToken({
      userId: created.id_user,
      username: created.username,
      role: created.role,
      idInstitution: created.id_institution,
    });

    res.status(201).json({
      token,
      expiresIn,
      user: {
        id: created.id_user,
        username: created.username,
        role: created.role,
        name: created.name,
        lastName: created.last_name,
        first_login: created.first_login,
        institution: created.id_institution ? { id: created.id_institution, name: created.institution_name } : null,
      },
    });
  } catch (error: any) {
    if (error?.message?.includes('Duplicate') || (error?.code && (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_DUP_KEY'))) {
      next(new ApiError(409, 'User with given username already exists'));
      return;
    }
    next(error);
  }
});
