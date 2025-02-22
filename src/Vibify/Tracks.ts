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
            let limit = 50;
            const spotifyResponse = await this.getSavedTracks(userId, {limit: 1, offset: 0});
            const total = spotifyResponse.total;
            let totalFromDb = await this.LikedCount((await this.spotify.user.getFromDb(userId)).id);
            log(`Spotify reports ${total} total liked tracks.`, 'info');

            let offset = total - totalFromDb - 50;
            if (offset < 0) {
                offset = 0;
                limit = total - totalFromDb;
            }
            if (limit <= 0) {
                log('All tracks are already in the database.', 'success');
                return;
            }

            while (totalFromDb < total) {
                const spotifyResponse = await this.getSavedTracks(userId, {limit: limit, offset});

                if (spotifyResponse.items.length > 0) {
                    log(`Inserting ${spotifyResponse.items.length} new tracks into the database...`, 'info');
                    await this.insertSavedTracks(userId, spotifyResponse.items);
                    totalFromDb += spotifyResponse.items.length;
                }
                offset -= 50;
            }
        });
    }
}

export default Tracks;