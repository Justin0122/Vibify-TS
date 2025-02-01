import { PaginationOptions } from '@/types/spotify';
import Spotify from "@/services/Spotify";

export async function getSpotifyPlaylists(this: Spotify, userId: string, options: PaginationOptions): Promise<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
    return this.handler(userId, async () => {
        const spotifyPlaylists = await this.spotifyApi.getUserPlaylists(options);
        return spotifyPlaylists.body as SpotifyApi.ListOfUsersPlaylistsResponse;
    });
}

export async function getSpotifyPlaylist(this: Spotify, userId: string, playlistId: string): Promise<SpotifyApi.SinglePlaylistResponse> {
    return this.handler(userId, async () => {
        const spotifyPlaylist = await this.spotifyApi.getPlaylist(playlistId);
        return spotifyPlaylist.body;
    });
}

export async function createSpotifyPlaylist(this: Spotify, userId: string, name: string, description: string, isPublic: boolean): Promise<SpotifyApi.CreatePlaylistResponse> {
    return this.handler(userId, async () => {
        const spotifyPlaylist = await this.spotifyApi.createPlaylist(name, {
            description,
            public: isPublic,
        });
        return spotifyPlaylist.body;
    });
}

export async function addTracksToPlaylist(this: Spotify, userId: string, playlistId: string, trackUris: string[]): Promise<void> {
    return this.handler(userId, async () => {
        const batchSize = 50;
        for (let i = 0; i < trackUris.length; i += batchSize) {
            const batch = trackUris.slice(i, i + batchSize);
            await this.spotifyApi.addTracksToPlaylist(playlistId, batch);
        }
    });
}