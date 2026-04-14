import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { ApiError } from './errorHandler.js';
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next(new ApiError(401, 'Missing bearer token'));
    }
    const token = header.replace('Bearer ', '').trim();
    if (!token) {
        return next(new ApiError(401, 'Missing bearer token'));
    }
    try {
        const payload = jwt.verify(token, appConfig.auth.jwtSecret);
        const subject = Number(payload.sub);
        if (!subject || Number.isNaN(subject)) {
            throw new ApiError(401, 'Invalid token payload');
        }
        req.user = {
            id: subject,
            username: payload.username,
            role: payload.role ?? null,
            id_institution: payload.inst ?? null,
        };
        return next();
    }
    catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }
        return next(new ApiError(401, 'Invalid or expired token'));
    }
}
