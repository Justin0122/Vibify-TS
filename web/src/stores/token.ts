import { api } from '../lib/api';

let cache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(force = false): Promise<string> {
    if (!force && cache && Date.now() < cache.expiresAt - 60_000) return cache.token;
    const { access_token, expires_at } = await api.playbackToken();
    cache = { token: access_token, expiresAt: new Date(expires_at).getTime() };
    return access_token;
}
