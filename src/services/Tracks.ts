import { PaginationOptions } from '@/types/spotify';
import Spotify from "@/services/Spotify";

export async function getTopArtists(this: Spotify, userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersTopArtistsResponse> {
    return this.handler(userId, async () => {
        const topArtists = await this.spotifyApi.getMyTopArtists(options);
        return topArtists.body;
    });
}

export async function getTopTracks(this: Spotify, userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersTopTracksResponse> {
    return this.handler(userId, async () => {
        const topTracks = await this.spotifyApi.getMyTopTracks(options);
        return topTracks.body;
    });
}

export async function getSavedTracks(this: Spotify, userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
    return this.handler(userId, async () => {
        const savedTracks = await this.spotifyApi.getMySavedTracks(options);
        return savedTracks.body;
    });
}

export async function getRecentlyPlayedTracks(this: Spotify, userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
    return this.handler(userId, async () => {
        const recentlyPlayedTracks = await this.spotifyApi.getMyRecentlyPlayedTracks(options);
        return recentlyPlayedTracks.body;
    });
}

export async function getCurrentPlayback(this: Spotify, userId: string): Promise<SpotifyApi.CurrentlyPlayingResponse> {
    return this.handler(userId, async () => {
        const currentPlayback = await this.spotifyApi.getMyCurrentPlayingTrack();
        return currentPlayback.body;
    });
}

/**
 * @deprecated Spotify has removed the getAudioFeaturesForTracks feature.
 */
export async function getAudioFeaturesForTracks(this: Spotify, userId: string, trackIds: string[]): Promise<SpotifyApi.MultipleAudioFeaturesResponse> {
    return this.handler(userId, async () => {
        const audioFeatures = await this.spotifyApi.getAudioFeaturesForTracks(trackIds);
        return audioFeatures.body;
    });
}