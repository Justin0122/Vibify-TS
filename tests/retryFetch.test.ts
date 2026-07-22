import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryFetch } from '@/spotify/retryFetch';
import { AppError } from '@/middlewares/errors';

const response = (status: number, headers: Record<string, string> = {}) =>
    new Response(status === 204 ? null : '{}', { status, headers });

describe('retryFetch', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('passes through successful responses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
        const res = await retryFetch('https://api.spotify.com/v1/me');
        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 honoring Retry-After', async () => {
        vi.useFakeTimers();
        const mock = vi
            .fn()
            .mockResolvedValueOnce(response(429, { 'Retry-After': '2' }))
            .mockResolvedValueOnce(response(200));
        vi.stubGlobal('fetch', mock);

        const promise = retryFetch('https://api.spotify.com/v1/me');
        await vi.advanceTimersByTimeAsync(2000);
        const res = await promise;
        expect(res.status).toBe(200);
        expect(mock).toHaveBeenCalledTimes(2);
    });

    it('throws AppError 429 after exhausting retries', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, { 'Retry-After': '1' })));

        const promise = retryFetch('https://api.spotify.com/v1/me');
        const assertion = expect(promise).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;
    });

    it('retries 5xx with backoff, then succeeds', async () => {
        vi.useFakeTimers();
        const mock = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(200));
        vi.stubGlobal('fetch', mock);
        const promise = retryFetch('https://api.spotify.com/v1/me');
        await vi.advanceTimersByTimeAsync(1000);
        expect((await promise).status).toBe(200);
        expect(mock).toHaveBeenCalledTimes(2);
    });

    it('maps persistent 5xx to AppError 502 after retries', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503)));
        const promise = retryFetch('https://api.spotify.com/v1/me');
        const assertion = expect(promise).rejects.toBeInstanceOf(AppError);
        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;
    });
});
