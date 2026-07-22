import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('@/db/database', () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn(() => ({ first }));
    const where = vi.fn(() => ({ select, first }));
    return { default: vi.fn(() => ({ where })) };
});
vi.mock('@/redisClient', () => ({
    default: { get: vi.fn().mockResolvedValue(null), setex: vi.fn(), getdel: vi.fn().mockResolvedValue(null) },
}));

import { createApp } from '@/app';

const app = createApp();

describe('app', () => {
    it('GET /api returns service info', async () => {
        const res = await request(app).get('/api');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ name: 'Vibify API' });
    });

    it('unknown API route returns 404 JSON (UI fallback handles the rest)', async () => {
        const res = await request(app).get('/api/definitely-not-a-route');
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('404');
    });

    it('protected route without key returns 401 JSON', async () => {
        const res = await request(app).get('/me/top/tracks');
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('player route with unknown key returns 401', async () => {
        const res = await request(app).get('/me/player/devices').set('x-api-key', 'bogus');
        expect(res.status).toBe(401);
    });

    it('auth exchange with missing code returns 400', async () => {
        const res = await request(app).post('/auth/exchange').send({});
        expect(res.status).toBe(400);
    });
});
