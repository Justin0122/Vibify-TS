import Spotify from "@/Vibify/Spotify";
import {MonthOptions, PaginationOptions} from "@/types/spotify";
import TrackService from "@/Vibify/Track/track.service";
import {log} from "@/types/spotify";

class Track {
    private trackService: TrackService;

    constructor(spotify: Spotify) {
        this.trackService = new TrackService(spotify);
    }

    async getLikedYears(userId: string): Promise<number[]> {
        return this.trackService.getLikedYears(userId);
    }

    async getLikedMonths(userId: string, year: number): Promise<number[]> {
        return this.trackService.getLikedMonths(userId, year);
    }

    async getTopTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopTracksResponse> {
        return this.trackService.getTopTracks(userId, options, log, logImages);
    }

    async getSavedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
        return this.trackService.getSavedTracks(userId, options);
    }

    async getRecentlyPlayedTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
        return this.trackService.getRecentlyPlayedTracks(userId, options, log, logImages);
    }

    async getCurrentPlayback(userId: string, log: log | null = null): Promise<SpotifyApi.CurrentlyPlayingResponse> {
        return this.trackService.getCurrentPlayback(userId, log);
    }

    async saveLikedTracks(userId: string, log: log): Promise<void> {
        return this.trackService.saveLikedTracks(userId, log);
    }

    async getTracksFromPeriod(userId: string, monthOptions: MonthOptions): Promise<SpotifyApi.TrackObjectFull[]> {
        return this.trackService.getTracksFromPeriod(userId, monthOptions);
    }
}

export default Track;