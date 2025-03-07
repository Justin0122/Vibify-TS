import db from '@/db/database';
import fetch from 'node-fetch';
import {User} from '@/Vibify/User/user.types';
import SpotifyWebApi from "spotify-web-api-node";

class TokenService {
    private spotifyApi: SpotifyWebApi;

    constructor(spotifyApi: SpotifyWebApi) {
        this.spotifyApi = spotifyApi;
    }

    setSpotifyTokens(accessToken: string, refreshToken: string): void {
        this.spotifyApi.setAccessToken(accessToken);
        this.spotifyApi.setRefreshToken(refreshToken);
    }

    async getSpotifyTokens(userId: string): Promise<{ accessToken: string, refreshToken: string }> {
        const user: User = await db('users').where('user_id', userId).first();
        return {
            accessToken: user.access_token,
            refreshToken: user.refresh_token,
        };
    }

    async tokenHandler(userId: string): Promise<void> {
        const user: User = await db('users').where('user_id', userId).first();
        if (!user) {
            throw new Error('User not found');
        }
        if (user.expires_at <= new Date()) {
            const {access_token, refresh_token} = await this.refreshAccessToken(user.refresh_token);
            const expires_in = 3600;
            const expires_at = new Date(Date.now() + expires_in * 1000);
            await db('users').where('user_id', userId).update({
                access_token,
                refresh_token,
                expires_in,
                expires_at,
                updated_at: new Date(),
            });
            this.setSpotifyTokens(access_token as string, refresh_token as string);
        } else {
            this.setSpotifyTokens(user.access_token, user.refresh_token);
        }
    }

    async refreshAccessToken(refreshToken: string): Promise<{ access_token: string, refresh_token: string }> {
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.spotifyApi.getClientId()}:${this.spotifyApi.getClientSecret()}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }).toString(),
        };

        const response = await fetch(authOptions.url, {
            method: 'POST',
            headers: authOptions.headers,
            body: authOptions.body,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as { access_token: string, refresh_token: string };
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
        };
    }
}

export default TokenService;