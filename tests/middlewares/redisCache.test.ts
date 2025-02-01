import request from 'supertest';
import express, {Request, Response, NextFunction} from 'express';
import 'jest';

const redis = {
    get: jest.fn(),
    setex: jest.fn()
};

jest.mock('../../src/redisClient', () => redis);
import cache from '../../src/middlewares/redisCache';

const app = express();
app.use((req: Request, res: Response, next: NextFunction) => {
    cache(req, res, next).catch(next);
});


describe('redisCache middleware', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should return cached data if available', async () => {
        const cachedData = JSON.stringify({message: 'Hello from cache'});
        (redis.get as jest.Mock).mockResolvedValue(cachedData);

        const response = await request(app).get('/test-url');
        expect(response.status).toBe(200);
        expect(response.body).toEqual(JSON.parse(cachedData));
        expect(redis.get).toHaveBeenCalledWith('/test-url');
    });

    it('should proceed to next middleware if no cached data', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        const next = jest.fn();

        const req = {originalUrl: '/test-url'} as Request;
        const res = {} as Response;

        await cache(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(redis.get).toHaveBeenCalledWith('/test-url');
    });

});