import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => {
    const store = new Map<string, string>();
    return {
        store,
        setex: vi.fn(async (key: string, _ttl: number, value: string) => {
            store.set(key, value);
            return 'OK';
        }),
        getdel: vi.fn(async (key: string) => {
            const value = store.get(key) ?? null;
            store.delete(key);
            return value;
        }),
        get: vi.fn(),
    };
});

vi.mock('@/redisClient', () => ({ default: redisMock }));
vi.mock('@/db/database', () => ({ default: vi.fn() }));
vi.mock('@/config', () => ({
    default: {
        spotify: { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://x/callback' },
        frontendUrl: 'http://x',
    },
}));

import { redeemOneTimeCode, hasPlayerScopes } from '@/services/auth.service';

describe('one-time code', () => {
    beforeEach(() => redisMock.store.clear());

    it('redeems exactly once', async () => {
        redisMock.store.set('auth:otc:abc', JSON.stringify({ userId: 'justin', apiToken: 'tok' }));
        await expect(redeemOneTimeCode('abc')).resolves.toEqual({ userId: 'justin', apiToken: 'tok' });
        await expect(redeemOneTimeCode('abc')).rejects.toMatchObject({ status: 400, code: 'INVALID_OTC' });
    });

    it('rejects unknown code', async () => {
        await expect(redeemOneTimeCode('nope')).rejects.toMatchObject({ status: 400 });
    });
});

describe('hasPlayerScopes', () => {
    it('true only when both playback scopes granted', () => {
        expect(hasPlayerScopes('user-read-playback-state user-modify-playback-state streaming')).toBe(true);
        expect(hasPlayerScopes('user-read-playback-state')).toBe(false);
        expect(hasPlayerScopes(null)).toBe(false);
    });
});
