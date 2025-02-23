import Spotify from "@/Vibify/Spotify";
import {log, MonthOptions, PaginationOptions} from "@/types/spotify";
import PlaylistService from "@/Vibify/Playlist/playlist.service";

class Track {
    private playlistService: PlaylistService;

    constructor(spotify: Spotify) {
        this.playlistService = new PlaylistService(spotify);
    }

    async getSpotifyPlaylists(userId: string, options: PaginationOptions): Promise<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
        return this.playlistService.getSpotifyPlaylists(userId, options);
    }

    async getSpotifyPlaylist(userId: string, playlistId: string): Promise<SpotifyApi.SinglePlaylistResponse> {
        return this.playlistService.getSpotifyPlaylist(userId, playlistId);
    }

    async createSpotifyPlaylist(userId: string, name: string, description: string, isPublic: boolean, monthOptions: MonthOptions | undefined, log: log | undefined): Promise<SpotifyApi.CreatePlaylistResponse> {
        return this.playlistService.createSpotifyPlaylist(userId, name, description, isPublic, monthOptions as MonthOptions, log);
    }

    async addTracksToPlaylist(userId: string, playlistId: string, trackUris: string[], log: log): Promise<void> {
        return this.playlistService.addTracksToPlaylist(userId, playlistId, trackUris, log);
    }

    async createSpotifyPlaylistForAllMonths(userId: string, log: log): Promise<void> {
        return this.playlistService.createSpotifyPlaylistForAllMonths(userId, log);
    }
}

export default Track;