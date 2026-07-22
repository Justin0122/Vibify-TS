import crypto from 'node:crypto';
import db from '@/db/database';
import redis from '@/redisClient';
import config from '@/config';
import { AppError } from '@/middlewares/errors';
import { getFreshAccessToken } from '@/spotify/tokens';

export const SPOTIFY_SCOPES = [
    'user-read-email',
    'user-read-private',
    'user-library-read',
    'user-library-modify',
    'user-top-read',
    'user-read-recently-played',
    'user-read-currently-playing',
    'user-follow-read',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
];

export const PLAYER_SCOPES = ['user-read-playback-state', 'user-modify-playback-state'];

const OTC_TTL_SECONDS = 120;
const otcKey = (code: string) => `auth:otc:${code}`;

export function buildAuthorizeUrl(userId: string): string {
    const params = new URLSearchParams({
        client_id: config.spotify.clientId,
        response_type: 'code',
        redirect_uri: config.spotify.redirectUri,
        scope: SPOTIFY_SCOPES.join(' '),
        state: userId,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleCallback(code: string, userId: string): Promise<string> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.spotify.redirectUri,
        }).toString(),
    });

    if (!response.ok) {
        throw new AppError(502, `Spotify code exchange failed (${response.status})`);
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
    };

    const apiToken = crypto.createHash('sha256').update(`${userId}${data.access_token}`).digest('hex');
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    const row = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: expiresAt,
        api_token: apiToken,
        scopes: data.scope,
        updated_at: new Date(),
    };

    const existing = await db('users').where('user_id', userId).first();
    if (existing) await db('users').where('user_id', userId).update(row);
    else await db('users').insert({ user_id: userId, ...row });

    const otc = crypto.randomBytes(32).toString('hex');
    await redis.setex(otcKey(otc), OTC_TTL_SECONDS, JSON.stringify({ userId, apiToken }));
    return otc;
}

export async function redeemOneTimeCode(code: string): Promise<{ userId: string; apiToken: string }> {
    const payload = await redis.getdel(otcKey(code));
    if (!payload) throw new AppError(400, 'Invalid or expired code', 'INVALID_OTC');
    return JSON.parse(payload);
}

export async function getPlaybackToken(userId: string): Promise<{ access_token: string; expires_at: string }> {
    const token = await getFreshAccessToken(userId);
    return { access_token: token.accessToken, expires_at: token.expiresAt.toISOString() };
}

export function hasPlayerScopes(scopes: string | null): boolean {
    if (!scopes) return false;
    const granted = new Set(scopes.split(' '));
    return PLAYER_SCOPES.every(scope => granted.has(scope));
}
