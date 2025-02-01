import { Request, Response, NextFunction } from 'express';
import redis from '../redisClient';

const redisCache = (req: Request, res: Response, next: NextFunction) => {
    redis.get(req.originalUrl).then(cachedData => {
        if (cachedData) {
            console.log('Cache hit!');
            return res.status(200).json(JSON.parse(cachedData));
        } else {
            console.log('Cache miss!');
        }
        const originalJson = res.json ? res.json.bind(res) : (body: unknown) => body;
        res.json = (body: unknown): Response => {
            redis.setex(req.originalUrl, 3600, JSON.stringify(body)).then(() => {
                originalJson(body);
            }).catch((err) => {
                console.error('Error setting cache:', err);
            });
            return <Response>originalJson(body);
        };

        next();
    }).catch(next);
};

export default redisCache;