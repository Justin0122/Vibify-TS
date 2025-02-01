import { Request, Response, NextFunction } from 'express';
import db from '../db/database';

export default async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
    if (process.env.DEV_MODE === 'true') {
        next();
        return;
    }
    const apiKey = req.headers['x-api-key'] as string;
    const application_id = req.headers['x-application-id'] as string;
    if (application_id) {
        if (application_id === process.env.APPLICATION_ID) {
            next();
        } else {
            res.status(403).json({ error: 'Unauthorized' });
        }
        return;
    }

    const userId = req.params.id || req.body.id;
    const user = await db('users').where('user_id', userId).first();
    if (user.api_token === apiKey) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
}