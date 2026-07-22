import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';

const dbMock = vi.hoisted(() => {
    const first = vi.fn();
    const select = vi.fn(() => ({ first }));
    const where = vi.fn(() => ({ select }));
    const db = vi.fn(() => ({ where }));
    return { db, first };
});

vi.mock('@/db/database', () => ({ default: dbMock.db }));
vi.mock('@/config', () => ({
    default: {
        devMode: false,
        devUserId: undefined,
        applicationId: 'app-123',
        corsOrigins: [],
    },
}));

import authenticate, { AuthedRequest } from '@/middlewares/auth';

function makeReq(headers: Record<string, string>): AuthedRequest {
    return { header: (name: string) => headers[name.toLowerCase()] } as unknown as AuthedRequest;
}

function run(req: AuthedRequest): Promise<Error | undefined> {
    return new Promise(resolve => {
        authenticate(req, {} as Response, ((err?: Error) => resolve(err)) as NextFunction);
    });
}

describe('auth middleware', () => {
    beforeEach(() => {
        dbMock.first.mockReset();
    });

    it('attaches user for valid api key', async () => {
        dbMock.first.mockResolvedValue({ id: 1, user_id: 'justin', scopes: 'streaming' });
        const req = makeReq({ 'x-api-key': 'valid' });
        const err = await run(req);
        expect(err).toBeUndefined();
        expect(req.user).toMatchObject({ user_id: 'justin' });
    });

    it('401 for unknown api key (no crash)', async () => {
        dbMock.first.mockResolvedValue(undefined);
        const err = await run(makeReq({ 'x-api-key': 'bogus' }));
        expect(err).toMatchObject({ status: 401 });
    });

    it('allows application id + user header', async () => {
        dbMock.first.mockResolvedValue({ id: 2, user_id: 'bot-user', scopes: null });
        const req = makeReq({ 'x-application-id': 'app-123', 'x-user-id': 'bot-user' });
        const err = await run(req);
        expect(err).toBeUndefined();
        expect(req.user).toMatchObject({ user_id: 'bot-user' });
    });

    it('rejects wrong application id', async () => {
        const err = await run(makeReq({ 'x-application-id': 'wrong', 'x-user-id': 'bot-user' }));
        expect(err).toMatchObject({ status: 401 });
    });

    it('401 when no credentials at all', async () => {
        const err = await run(makeReq({}));
        expect(err).toMatchObject({ status: 401 });
    });
});
