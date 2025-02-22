import crypto from 'crypto';
import chalk from 'chalk';
import { SpotifyAuthorizationResponse } from '@/types/spotify';
import { insertUserIntoDatabase } from './Database';
import Spotify from "@/Vibify/Spotify";

export async function authorizationCodeGrant(this: Spotify, code: string, id: string): Promise<SpotifyAuthorizationResponse> {
    try {
        const data = await this.spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = data.body;
        const api_token = crypto.createHash('sha256').update(id + access_token).digest('hex');
        await insertUserIntoDatabase(id, access_token, refresh_token, expires_in, api_token);
        return { api_token, userId: id };
    } catch (err) {
        console.log(chalk.red('Something went wrong!'), err);
        throw err;
    }
}