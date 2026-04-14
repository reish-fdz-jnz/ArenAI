  import jwt, { SignOptions } from 'jsonwebtoken';
  import bcrypt from 'bcryptjs';
  import { appConfig } from '../config/env.js';

  export interface SignTokenPayload {
    userId: number;
    username: string;
    role: string | null;
    idInstitution?: number | null;
  }

  export interface TokenResponse {
    token: string;
    expiresIn: string;
  }

  export function signAccessToken({ userId, username, role, idInstitution }: SignTokenPayload): TokenResponse {
    const payload = {
      sub: String(userId),
      username,
      role,
      inst: idInstitution ?? null,
    };

    const signOptions: SignOptions = {
      expiresIn: appConfig.auth.jwtExpiresIn as SignOptions['expiresIn'],
    };

    const token = jwt.sign(payload, appConfig.auth.jwtSecret, signOptions);

    return { token, expiresIn: appConfig.auth.jwtExpiresIn };
  }

  export async function verifyPassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }

  export async function hashPassword(plain: string) {
    const saltRounds = 10;
    return bcrypt.hash(plain, saltRounds);
  }
