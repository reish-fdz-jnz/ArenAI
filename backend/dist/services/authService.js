import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { appConfig } from '../config/env.js';
export function signAccessToken({ userId, username, role, idInstitution }) {
    const payload = {
        sub: String(userId),
        username,
        role,
        inst: idInstitution ?? null,
    };
    const signOptions = {
        expiresIn: appConfig.auth.jwtExpiresIn,
    };
    const token = jwt.sign(payload, appConfig.auth.jwtSecret, signOptions);
    return { token, expiresIn: appConfig.auth.jwtExpiresIn };
}
export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
export async function hashPassword(plain) {
    const saltRounds = 10;
    return bcrypt.hash(plain, saltRounds);
}
