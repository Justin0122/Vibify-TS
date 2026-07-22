import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import config from '@/config';
import { getFreshAccessToken } from '@/spotify/tokens';
import { retryFetch } from '@/spotify/retryFetch';

// Always hand the SDK a pre-refreshed token: its own refresh path is PKCE-style
// (wrong for this confidential app) and wouldn't persist rotated tokens to MySQL.
export async function getClient(userId: string): Promise<SpotifyApi> {
    const token = await getFreshAccessToken(userId);
    return SpotifyApi.withAccessToken(
        config.spotify.clientId,
        {
            access_token: token.accessToken,
            token_type: 'Bearer',
            expires_in: Math.max(Math.floor((token.expiresAt.getTime() - Date.now()) / 1000), 1),
            refresh_token: token.refreshToken,
        },
        { fetch: retryFetch },
    );
}
