import Spotify from "@/Vibify/Spotify";
import {PaginationOptions} from "@/types/spotify";
import db from "@/db/database";
import chalk from "chalk";
import {log} from "@/types/spotify";

class TrackService {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getTopTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopTracksResponse> {
        return this.spotify.handler(userId, async () => {
            const topTracks = await this.spotify.spotifyApi.getMyTopTracks(options);
            if (log) await this.logTracks(topTracks.body.items, log, logImages);
            return topTracks.body;
        });
    }

    async getSavedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
        return this.spotify.handler(userId, async () => (await this.spotify.spotifyApi.getMySavedTracks(options)).body);
    }

    async getRecentlyPlayedTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
        return this.spotify.handler(userId, async () => {
            const recentlyPlayedTracks = await this.spotify.spotifyApi.getMyRecentlyPlayedTracks(options);
            if (log) await this.logTracks(recentlyPlayedTracks.body.items.map(item => item.track), log, logImages);
            return recentlyPlayedTracks.body;
        });
    }

    private async LikedCount(userDbId: number): Promise<number> {
        const countResult = await db('liked_tracks').where({user_id: userDbId}).count({count: '*'}).first();
        return Number(countResult?.count ?? 0);
    }

    async getCurrentPlayback(userId: string, log: log | null = null): Promise<SpotifyApi.CurrentlyPlayingResponse> {
        return this.spotify.handler(userId, async () => {
            const currentPlayback = await this.spotify.spotifyApi.getMyCurrentPlayingTrack();
            if (currentPlayback.body) {
                await this.logCurrentPlayback(currentPlayback.body, log);
            }
            return currentPlayback.body;
        });
    }

    private async logTracks(tracks: SpotifyApi.TrackObjectFull[], log: log, logImages: boolean): Promise<void> {
        for (const track of tracks) {
            await log(`Track: ${track.name} by ${track.artists[0].name}`, 'info');
            if (track.album.images.length > 0 && logImages) await log(track.album.images[0].url, 'image');
        }
    }

    private async logCurrentPlayback(currentPlayback: SpotifyApi.CurrentlyPlayingObject, log: log | null): Promise<void> {
        if (log && currentPlayback.currently_playing_type === 'track' && currentPlayback.item && 'artists' in currentPlayback.item && 'album' in currentPlayback.item) {
            log(`Currently playing: ${currentPlayback.item.name} by ${currentPlayback.item.artists[0].name}`, 'info');
            if (currentPlayback.item.album.images.length > 0) await log(currentPlayback.item.album.images[0].url, 'image');
            if (currentPlayback.is_playing) this.displayProgress(log, currentPlayback.progress_ms!, currentPlayback.item.duration_ms!);
        }
    }

    private displayProgress(log: log, progress: number, duration: number): void {
        const progressSeconds = Math.floor(progress / 1000);
        const durationSeconds = Math.floor(duration / 1000);
        const percentage = (progress / duration) * 100;
        const progressBarLength = 50;
        const progressBarFilledLength = Math.floor((progressBarLength * percentage) / 100);
        const progressBarEmptyLength = progressBarLength - progressBarFilledLength;
        const progressText = `${progressSeconds}s / ${durationSeconds}s`;
        const progressTextPosition = Math.floor(progressBarLength / 2) - Math.floor(progressText.length / 2);

        const progressBar = chalk.green('█'.repeat(progressBarFilledLength)) + chalk.white('█'.repeat(progressBarEmptyLength));
        const centeredProgressText = ' '.repeat(progressTextPosition) + progressText;

        log(centeredProgressText, 'info');
        log(`${progressBar} ${Math.floor(percentage)}%`, 'info');
    }

    async processTrack(track: SpotifyApi.SavedTrackObject, artistDetailsMap: Map<string, SpotifyApi.ArtistObjectFull>, userIntId: number): Promise<void> {
        const artist = track.track.artists[0];
        const artistDetails = artistDetailsMap.get(artist.id);
        const genres = artistDetails?.genres || [];

        await this.spotify.artist.insertArtist(artist.id, artist.name);
        for (const genre of genres) await this.spotify.genre.processGenre(genre, artist.id);

        const artistId = (await db('artists').where({artist_id: artist.id}).select('id').first()).id;
        await this.insertTrack(track.track.id, track.track.name, artistId);
        const trackId = (await db('tracks').where({track_id: track.track.id}).select('id').first()).id;
        await this.insertLikedTrack(userIntId, trackId, track.added_at);
    }

    async insertSavedTracks(userId: string, savedTracks: SpotifyApi.SavedTrackObject[]): Promise<void> {
        return this.spotify.handler(userId, async () => {
            const uniqueArtistIds = Array.from(new Set(savedTracks.map(track => track.track.artists[0].id)));
            const artistDetailsMap = await this.spotify.artist.getArtistDetailsMap(uniqueArtistIds);
            const userIntId = await this.spotify.user.getId(userId);

            for (const track of savedTracks) {
                await this.processTrack(track, artistDetailsMap, userIntId);
            }
        });
    }

    async saveLikedTracks(userId: string, log: log): Promise<void> {
        return this.spotify.handler(userId, async () => {
            const {total} = await this.getSavedTracks(userId, {limit: 1, offset: 0});
            const userDbId = (await this.spotify.user.getFromDb(userId)).id;
            let totalFromDb = await this.LikedCount(userDbId);
            log(`Spotify reports ${total} total liked tracks.`, 'info');

            let offset = Math.max(total - totalFromDb - 50, 0);
            const limit = Math.max(total - totalFromDb, 0);

            if (limit <= 0) {
                log('All tracks are already in the database.', 'success');
                return;
            }

            while (totalFromDb < total) {
                const {items} = await this.getSavedTracks(userId, {limit, offset});
                if (items.length > 0) {
                    log(`Inserting ${items.length} new tracks into the database...`, 'info');
                    await this.insertSavedTracks(userId, items);
                    totalFromDb += items.length;
                }
                offset -= 50;
            }
        });
    }

    private async insertLikedTrack(userId: number, trackId: number, addedAt: string) {
        await db('liked_tracks').insert({
            user_id: userId,
            track_id: trackId,
            added_at: addedAt,
            year: new Date(addedAt).getFullYear(),
            month: new Date(addedAt).getMonth() + 1
        });
    }

    private async insertTrack(trackId: string, name: string, artistId: number) {
        await db('tracks')
            .insert({track_id: trackId, name, artist_id: artistId})
            .onConflict('track_id')
            .ignore();
    }
}

export default TrackService;