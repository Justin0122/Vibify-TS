import { NextFunction, Request, Response } from 'express';
import db from '@/db/database';
import config from '@/config';
import { AppError, asyncHandler } from '@/middlewares/errors';
import { UserRow } from '@/types/db';

export interface AuthedRequest extends Request {
    user?: Pick<UserRow, 'id' | 'user_id' | 'scopes'>;
}

async function loadUser(where: Partial<Record<string, string>>): Promise<Pick<UserRow, 'id' | 'user_id' | 'scopes'>> {
    const user = await db('users').where(where).select('id', 'user_id', 'scopes').first();
    if (!user) throw new AppError(401, 'Unknown user or API key', 'UNAUTHORIZED');
    return user;
}

const authenticate = asyncHandler(async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const apiKey = req.header('x-api-key');
    const applicationId = req.header('x-application-id');
    const headerUserId = req.header('x-user-id');

    if (apiKey) {
        req.user = await loadUser({ api_token: apiKey });
        return next();
    }

    if (applicationId && config.applicationId && applicationId === config.applicationId && headerUserId) {
        req.user = await loadUser({ user_id: headerUserId });
        return next();
    }

    if (config.devMode && config.devUserId) {
        req.user = await loadUser({ user_id: config.devUserId });
        return next();
    }

    throw new AppError(401, 'Missing X-API-Key', 'UNAUTHORIZED');
});

export default authenticate;
