import {PaginationOptions, log} from '@/types/spotify';
import Spotify from "@/Vibify/Spotify";
import chalk from "chalk";
import db from "@/db/database";
import {insertArtist, insertLikedTrack, insertTrack} from "@/Vibify/Database";
import {processGenre} from "@/Vibify/Genre";

class Tracks {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getTopTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopTracksResponse> {
        return this.spotify.handler(userId, async () => {
            const topTracks = await this.spotify.spotifyApi.getMyTopTracks(options);
            await this.logTracks(topTracks.body.items, log, logImages);
            return topTracks.body;
        });
    }

    async getSavedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
        return this.spotify.handler(userId, async () => (await this.spotify.spotifyApi.getMySavedTracks(options)).body);
    }

    async getRecentlyPlayedTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
        return this.spotify.handler(userId, async () => {
            const recentlyPlayedTracks = await this.spotify.spotifyApi.getMyRecentlyPlayedTracks(options);
            await this.logTracks(recentlyPlayedTracks.body.items.map(item => item.track), log, logImages);
            return recentlyPlayedTracks.body;
        });
    }

    async LikedCount(userDbId: number): Promise<number> {
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

    private async logTracks(tracks: SpotifyApi.TrackObjectFull[], log: log | null, logImages: boolean): Promise<void> {
        if (log) {
            for (const track of tracks) {
                await log(`Track: ${track.name} by ${track.artists[0].name}`, 'info');
                if (track.album.images.length > 0 && logImages) await log(track.album.images[0].url, 'image');
            }
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

        await insertArtist(artist.id, artist.name);
        for (const genre of genres) await processGenre(genre, artist.id);

        const artistId = (await db('artists').where({artist_id: artist.id}).select('id').first()).id;
        await insertTrack(track.track.id, track.track.name, artistId);
        const trackId = (await db('tracks').where({track_id: track.track.id}).select('id').first()).id;
        await insertLikedTrack(userIntId, trackId, track.added_at);
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
            const user = await this.spotify.user.getFromDb(userId);
            const savedTracksCount = await this.LikedCount(user.id);
            log(`Starting offset set to ${savedTracksCount} based on already saved tracks.`, 'info');

            const {total} = await this.getSavedTracks(userId, {limit: 50, offset: 0});
            log(`Spotify reports ${total} total liked tracks.`, 'info');

            if (total === savedTracksCount) {
                log('No new tracks found.', 'warning');
                return;
            }

            const firstDuplicateFound = await this.insertNewTracksFromOffset(userId, total, log);
            if (firstDuplicateFound) return;
        });
    }

    private async insertNewTracksFromOffset(userId: string, total: number, log: log): Promise<boolean> {
        const savedTrackIds = await this.getSavedTrackIds(userId);
        let offset = 0;
        let firstDuplicateFound = false;

        while (offset < total) {
            const spotifyResponse = await this.getSavedTracks(userId, {limit: 50, offset});
            const currentTotal = spotifyResponse.total;

            const unsavedTracks = this.getUnsavedTracks(spotifyResponse.items, savedTrackIds, log);
            if (unsavedTracks.firstDuplicateFound) {
                firstDuplicateFound = true;
                const dbLikedTracksCount = await this.LikedCount((await this.spotify.user.getFromDb(userId)).id);
                if (dbLikedTracksCount < currentTotal) {
                    log('Continuing to process the rest of the tracks...', 'info');
                    await this.continueProcessingTracks(await this.spotify.user.getFromDb(userId), userId, log);
                }
                break;
            }

            if (unsavedTracks.tracks.length > 0) {
                log(`Inserting ${unsavedTracks.tracks.length} new tracks into the database...`, 'info');
                await this.insertSavedTracks(userId, unsavedTracks.tracks);
                unsavedTracks.tracks.forEach(item => savedTrackIds.add(item.track.id));
            }

            if (firstDuplicateFound) return true;
            offset += 50;
            if (offset >= currentTotal) break;
        }
        return false;
    }

    private async getSavedTrackIds(userId: string): Promise<Set<string>> {
        const userDbId = (await this.spotify.user.getFromDb(userId)).id;
        const savedTracks = await db('liked_tracks').join('tracks', 'liked_tracks.track_id', 'tracks.id').where({'liked_tracks.user_id': userDbId}).select('tracks.track_id');
        return new Set(savedTracks.map(record => record.track_id));
    }

    private getUnsavedTracks(items: SpotifyApi.SavedTrackObject[], savedTrackIds: Set<string>, log: log): {
        tracks: SpotifyApi.SavedTrackObject[],
        firstDuplicateFound: boolean
    } {
        const unsavedTracks: SpotifyApi.SavedTrackObject[] = [];
        let firstDuplicateFound = false;

        for (const item of items) {
            const spotifyTrackId = item.track.id;
            if (savedTrackIds.has(spotifyTrackId)) {
                firstDuplicateFound = true;
                log(`Duplicate found for track ID ${spotifyTrackId}, stopping batch insertion.`, 'success');
                break;
            }
            unsavedTracks.push(item);
        }

        return {tracks: unsavedTracks, firstDuplicateFound};
    }

    private async continueProcessingTracks(user: { id: number }, userId: string, log: log): Promise<void> {
        let offset = await this.LikedCount(user.id);
        const initialResponse = await this.getSavedTracks(userId, {limit: 50, offset: 0});
        const total = initialResponse.total;

        if (offset === total) {
            log('All tracks processed.', 'update-success');
            return;
        }
        log(`Continuing from offset: ${offset}`, 'success');

        while (offset < total) {
            const options: PaginationOptions = {limit: 50, offset};
            const response = await this.getSavedTracks(userId, options);
            if (response.items.length) {
                await this.insertSavedTracks(userId, response.items);
                log(`Processed ${Math.min(offset + (options.limit ?? 50), total)} out of ${total} tracks from Spotify.`, 'update-success');
            }
            offset += options.limit ?? 50;
        }
        log('All tracks processed.', 'update-success');
    }
}

export default Tracks;