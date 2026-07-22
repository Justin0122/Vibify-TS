import { AppError } from '@/middlewares/errors';

const MAX_ATTEMPTS = 4;
const MAX_RETRY_AFTER_S = 30;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function retryFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
    let response: Response = await fetch(input, init);
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
        if (response.status === 429) {
            const retryAfterS = Math.min(parseInt(response.headers.get('Retry-After') || '1', 10) || 1, MAX_RETRY_AFTER_S);
            await sleep(retryAfterS * 1000);
        } else if (response.status >= 500) {
            await sleep(2 ** (attempt - 1) * 1000);
        } else {
            return response;
        }
        response = await fetch(input, init);
    }
    if (response.status === 429) {
        throw new AppError(429, 'Spotify rate limit exceeded, try again later', 'RATE_LIMITED');
    }
    if (response.status >= 500) {
        throw new AppError(502, `Spotify API error (${response.status})`, 'SPOTIFY_UNAVAILABLE');
    }
    return response;
}
