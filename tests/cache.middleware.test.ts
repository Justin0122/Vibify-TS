import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';

const redisMock = vi.hoisted(() => ({
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue('OK'),
}));

vi.mock('@/redisClient', () => ({ default: redisMock }));

import { cache } from '@/middlewares/cache';
import { AuthedRequest } from '@/middlewares/auth';

function makeRes() {
    const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as unknown,
        jsonCalls: 0,
        setHeader(name: string, value: string) {
            this.headers[name] = value;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(body: unknown) {
            this.jsonCalls += 1;
            this.body = body;
            return this;
        },
    };
    return res as unknown as Response & typeof res;
}

const req = { user: { user_id: 'justin' }, originalUrl: '/me/top/tracks?limit=5' } as unknown as AuthedRequest;

describe('cache middleware', () => {
    beforeEach(() => {
        redisMock.get.mockReset();
        redisMock.setex.mockClear();
    });

    it('serves hit without calling next, exactly one response', async () => {
        redisMock.get.mockResolvedValue(JSON.stringify({ cached: true }));
        const res = makeRes();
        const next = vi.fn();
        await cache(60)(req, res, next as NextFunction);
        expect(next).not.toHaveBeenCalled();
        expect(res.jsonCalls).toBe(1);
        expect(res.body).toEqual({ cached: true });
        expect(res.headers['X-Cache']).toBe('HIT');
    });

    it('stores 2xx responses on miss with per-user key', async () => {
        redisMock.get.mockResolvedValue(null);
        const res = makeRes();
        const next = vi.fn();
        await cache(60)(req, res, next as NextFunction);
        expect(next).toHaveBeenCalledOnce();
        res.json({ fresh: true });
        expect(res.jsonCalls).toBe(1);
        expect(redisMock.setex).toHaveBeenCalledWith('cache:justin:/me/top/tracks?limit=5', 60, JSON.stringify({ fresh: true }));
    });

    it('does not store non-2xx responses', async () => {
        redisMock.get.mockResolvedValue(null);
        const res = makeRes();
        await cache(60)(req, res, vi.fn() as NextFunction);
        res.status(500).json({ error: 'boom' });
        expect(redisMock.setex).not.toHaveBeenCalled();
    });

    it('falls through to handler when redis errors', async () => {
        redisMock.get.mockRejectedValue(new Error('redis down'));
        const next = vi.fn();
        await cache(60)(req, makeRes(), next as NextFunction);
        expect(next).toHaveBeenCalledOnce();
    });
});
