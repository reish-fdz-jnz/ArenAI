import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

loadEnv();

const EnvSchema = z.object({
  PORT: z.string().optional().default('3000'),
  DB_HOST: z.string(),
  DB_PORT: z.string().transform((val) => {
    const parsed = Number(val);
    if (Number.isNaN(parsed)) {
      throw new Error('DB_PORT must be a number');
    }
    return parsed;
  }),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_SSL: z
    .string()
    .optional()
    .transform((value) => value === 'true')
    .optional(),
  DB_SSL_CA_PATH: z.string().optional(),
  DB_SSL_CERT_PATH: z.string().optional(),
  DB_SSL_KEY_PATH: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().optional().default('30d'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().optional().default('us-central1'),
});

const env = EnvSchema.parse(process.env);

if (env.DB_SSL && (!env.DB_SSL_CA_PATH || !env.DB_SSL_CERT_PATH || !env.DB_SSL_KEY_PATH)) {
  throw new Error('DB_SSL is true but one or more SSL file paths are missing.');
}

const resolvePath = (filePath?: string) => {
  if (!filePath) return undefined;
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
};

if (env.GOOGLE_APPLICATION_CREDENTIALS) {
  const resolvedPath = resolvePath(env.GOOGLE_APPLICATION_CREDENTIALS);
  if (resolvedPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
  }
}

export const appConfig = {
  port: Number(env.PORT),
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL
      ? {
          caPath: resolvePath(env.DB_SSL_CA_PATH),
          certPath: resolvePath(env.DB_SSL_CERT_PATH),
          keyPath: resolvePath(env.DB_SSL_KEY_PATH),
        }
      : null,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  },
  google: {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    location: env.GOOGLE_CLOUD_LOCATION,
  },
};
