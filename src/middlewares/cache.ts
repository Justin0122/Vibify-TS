import { NextFunction, Response } from 'express';
import redis from '@/redisClient';
import { AuthedRequest } from '@/middlewares/auth';

export function cache(ttlSeconds: number) {
    return async (req: AuthedRequest, res: Response, next: NextFunction) => {
        const key = `cache:${req.user?.user_id ?? 'anon'}:${req.originalUrl}`;
        try {
            const hit = await redis.get(key);
            if (hit) {
                res.setHeader('X-Cache', 'HIT');
                res.status(200).json(JSON.parse(hit));
                return;
            }
        } catch {
            return next();
        }

        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redis.setex(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
            }
            return originalJson(body);
        };
        next();
    };
}
