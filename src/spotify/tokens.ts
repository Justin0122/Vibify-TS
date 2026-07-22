import db from '@/db/database';
import config from '@/config';
import { AppError } from '@/middlewares/errors';
import { UserRow } from '@/types/db';

export interface FreshToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scopes: string | null;
}

const REFRESH_CUSHION_MS = 60_000;

// per-user mutex: parallel refreshes race on rotated refresh tokens
const inFlight = new Map<string, Promise<FreshToken>>();

export async function getFreshAccessToken(userId: string): Promise<FreshToken> {
    const user: UserRow | undefined = await db('users').where('user_id', userId).first();
    if (!user) throw new AppError(404, 'User not found. Authorize first via /auth/authorize/:userId', 'UNKNOWN_USER');

    if (new Date(user.expires_at).getTime() > Date.now() + REFRESH_CUSHION_MS) {
        return {
            accessToken: user.access_token,
            refreshToken: user.refresh_token,
            expiresAt: new Date(user.expires_at),
            scopes: user.scopes,
        };
    }

    const pending = inFlight.get(userId);
    if (pending) return pending;

    const refreshPromise = refreshAndPersist(user).finally(() => inFlight.delete(userId));
    inFlight.set(userId, refreshPromise);
    return refreshPromise;
}

async function refreshAndPersist(user: UserRow): Promise<FreshToken> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.refresh_token,
        }).toString(),
    });

    if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
            throw new AppError(401, 'Spotify refresh token rejected, re-authorization required', 'REAUTH_REQUIRED');
        }
        throw new AppError(502, `Spotify token refresh failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    const refreshToken = data.refresh_token || user.refresh_token;

    await db('users').where('user_id', user.user_id).update({
        access_token: data.access_token,
        refresh_token: refreshToken,
        expires_in: data.expires_in,
        expires_at: expiresAt,
        updated_at: new Date(),
    });

    return { accessToken: data.access_token, refreshToken, expiresAt, scopes: user.scopes };
}
