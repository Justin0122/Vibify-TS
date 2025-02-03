import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import chalk from 'chalk';
import {getSpotifyTokens, refreshAccessToken, setSpotifyTokens, tokenHandler} from './Tokens';
import {authorizationCodeGrant} from './Authorization';
import {getSpotifyUser} from './User';
import {getSpotifyPlaylist, getSpotifyPlaylists} from './Playlist';
import {
    deleteUserFromDatabase,
    insertArtist,
    insertArtistGenre,
    insertGenre,
    insertLikedTrack,
    insertTrack
} from '@/services/Database';
import {log, PaginationOptions, RecommendationsOptions} from '@/types/spotify';
import {buildApiOptions, gatherSeeds, getAudioFeaturesValues, setTargetValues} from "@/services/Recommendations";
import db from '@/db/database';

dotenv.config();

class Spotify {
    private readonly redirectUri: string;
    clientId: string;
    clientSecret: string;
    private isRateLimited: boolean;
    private apiCallCount: number;
    spotifyApi: SpotifyWebApi;
    private rateLimitPromise: Promise<void> | null;

    constructor() {
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
        this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
        this.isRateLimited = false;
        this.apiCallCount = 0;
        this.rateLimitPromise = null;

        this.spotifyApi = new SpotifyWebApi({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            redirectUri: this.redirectUri,
        });
    }

    setSpotifyTokens = setSpotifyTokens;
    getSpotifyTokens = getSpotifyTokens;
    tokenHandler = tokenHandler;
    refreshAccessToken = refreshAccessToken;
    authorizationCodeGrant = authorizationCodeGrant;
    getSpotifyUser = getSpotifyUser;
    deleteUser = deleteUserFromDatabase;
    getSpotifyPlaylists = getSpotifyPlaylists;
    getSpotifyPlaylist = getSpotifyPlaylist;

    private log(message: string): void {
        console.log(chalk.blue(`[Spotify] ${message}`));
    }

    async handler<T>(userId: string, action: () => Promise<T>): Promise<T> {
        await this.tokenHandler(userId);
        try {
            return await action();
        } catch (err: unknown) {
            if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
                this.isRateLimited = true;
                this.log('Rate limited, waiting...');
                await this.rateLimitHandler();
                return await this.handler(userId, action);
            }
            console.log(chalk.red('Error in handler'), err);
            this.log('Token expired, refreshing tokens...');
            await this.tokenHandler(userId);
            return await action();
        }
    }

    async rateLimitHandler(): Promise<void> {
        if (this.isRateLimited) {
            if (this.rateLimitPromise) {
                await this.rateLimitPromise;
            }
            this.rateLimitPromise = new Promise((resolve) => {
                setTimeout(() => {
                    this.isRateLimited = false;
                    this.apiCallCount = 0;
                    resolve();
                }, 1000);
            });
            await this.rateLimitPromise;
        }
    }

    async getTopArtists(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopArtistsResponse> {
        return this.handler(userId, async () => {
            const topArtists = await this.spotifyApi.getMyTopArtists(options);
            if (log) {
                for (const artist of topArtists.body.items) {
                    await log(`Artist: ${artist.name}`, 'info');
                    if (artist.images.length > 0 && logImages) {
                        await log(artist.images[0].url, 'image');
                    }
                }
            }
            return topArtists.body;
        });
    }


    async getTopTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopTracksResponse> {
        return this.handler(userId, async () => {
            const topTracks = await this.spotifyApi.getMyTopTracks(options);
            if (log) {
                for (const track of topTracks.body.items) {
                    await log(`Track: ${track.name} by ${track.artists[0].name}`, 'info');
                    if (track.album.images.length > 0 && logImages) {
                        await log(track.album.images[0].url, 'image');
                    }
                }
            }
            return topTracks.body;
        });
    }

    async getSavedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
        return this.handler(userId, async () => {
            const savedTracks = await this.spotifyApi.getMySavedTracks(options);
            return savedTracks.body;
        });
    }

    async getRecentlyPlayedTracks(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
        return this.handler(userId, async () => {
            const recentlyPlayedTracks = await this.spotifyApi.getMyRecentlyPlayedTracks(options);
            if (log) {
                for (const track of recentlyPlayedTracks.body.items) {
                    await log(`Track: ${track.track.name} by ${track.track.artists[0].name}`, 'info');
                    if (track.track.album.images.length > 0 && logImages) {
                        await log(track.track.album.images[0].url, 'image');
                    }
                }
            }
            return recentlyPlayedTracks.body;
        });
    }

    async getCurrentPlayback(userId: string, log: log | null = null): Promise<SpotifyApi.CurrentlyPlayingResponse> {
        return this.handler(userId, async () => {
            const currentPlayback = await this.spotifyApi.getMyCurrentPlayingTrack();
            if (!currentPlayback.body) {
                return currentPlayback.body;
            }
            if (log) {
                // make sure it is a track and not an episode
                if (currentPlayback.body.currently_playing_type === 'track' && currentPlayback.body.item && 'artists' in currentPlayback.body.item && 'album' in currentPlayback.body.item) {
                    log(`Currently playing: ${currentPlayback.body.item.name} by ${currentPlayback.body.item.artists[0].name}`, 'info');
                    if (currentPlayback.body.item.album.images.length > 0) {
                        await log(currentPlayback.body.item.album.images[0].url, 'image');
                    }
                    if (currentPlayback.body.is_playing) {
                        // display the time progress of the track
                        const duration = currentPlayback.body.item.duration_ms;
                        const progress = currentPlayback.body.progress_ms;
                        if (progress != null && duration != null) {
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
                    }
                }
            }
            return currentPlayback.body;
        });
    }

    /**
     * @deprecated Spotify has removed the Get Recommendations feature.
     * @see https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
     */
    async getRecommendations(userId: string, options: RecommendationsOptions): Promise<SpotifyApi.RecommendationsFromSeedsResponse | void> {
        return this.handler(userId, async () => {
            const seeds = await gatherSeeds.call(this, userId, options);
            const apiOptions = buildApiOptions(options);
            const audioFeaturesValues = await getAudioFeaturesValues.call(this, userId, seeds);
            await setTargetValues.call(this, apiOptions, audioFeaturesValues);

            const recommendations = await this.spotifyApi.getRecommendations(apiOptions);
            return recommendations.body;
        });
    }

    async getUserFromDb(userId: string): Promise<{ id: number }> {
        const user = await db('users').where({user_id: userId}).select('id').first();
        if (!user) throw new Error(`User with ID ${userId} not found`);
        return user;
    }

    async getDbLikedTracksCount(userDbId: number): Promise<number> {
        const countResult = await db('liked_tracks')
            .where({user_id: userDbId})
            .count({count: '*'})
            .first();
        return Number(countResult?.count ?? 0);
    }

    async deleteMissingTracks(user: string, total: number, userId: number, log: log): Promise<void> {
        log('Checking for missing tracks (batch‑wise) and removing them from the database...', 'warning');

        const dbLikedTracksCount = await this.getDbLikedTracksCount(userId);
        const totalDislikedTracks = dbLikedTracksCount - total;

        let offset = 0;
        while (offset < total) {
            const spotifyResponse = await this.getSavedTracks(user, {limit: 50, offset});
            const spotifyBatch = spotifyResponse.items;

            const dbBatch = await db('liked_tracks')
                .join('tracks', 'liked_tracks.track_id', 'tracks.id')
                .where({'liked_tracks.user_id': userId})
                .select('tracks.track_id', 'tracks.id', 'tracks.name')
                .orderBy('liked_tracks.added_at', 'desc')
                .limit(50)
                .offset(offset);

            for (let i = 0; i < spotifyBatch.length; i++) {
                const spotifyTrack = spotifyBatch[i].track;
                const dbTrack = dbBatch[i];

                if (!dbTrack || dbTrack.track_id !== spotifyTrack.id) {
                    if (dbTrack) {
                        log(`Detected missing track: ${dbTrack.name}. Deleting from database...`, 'warning');
                        await db('liked_tracks')
                            .where({user_id: userId})
                            .andWhere('track_id', dbTrack.id)
                            .del();
                        await db('tracks')
                            .where({id: dbTrack.id})
                            .del();
                        log(`Deleted track: ${dbTrack.name}`, 'info');
                    } else {
                        log(`Discrepancy found at batch index ${i}, but no matching DB record.`, 'warning');
                    }
                    break;
                }

                if (dbLikedTracksCount - i === totalDislikedTracks) {
                    log('All missing tracks have been removed.', 'update-success');
                    return;
                }
            }
            offset += 50;
        }
    }


    async saveLikedTracks(userId: string, log: log): Promise<void> {
        return this.handler(userId, async () => {
            const user = await this.getUserFromDb(userId);
            await this.removeDuplicateLikedTracks(user.id, log);
            const savedTracksCount = await this.getDbLikedTracksCount(user.id);
            log(`Starting offset set to ${savedTracksCount} based on already saved tracks.`, 'info');

            const {total} = await this.getSavedTracks(userId, {limit: 50, offset: 0});
            log(`Spotify reports ${total} total liked tracks.`, 'info');

            if (total < savedTracksCount) {
                await this.deleteMissingTracks(userId, total, user.id, log);
            } else if (total === savedTracksCount) {
                log('No new tracks found.', 'warning');
                return;
            }

            const firstDuplicateFound = await this.insertNewTracksFromOffset(userId, total, log);
            if (!firstDuplicateFound) {
                await this.continueProcessingTracks(user, userId, log);
            }

            if (await this.getDbLikedTracksCount(user.id) > total) {
                await this.removeDuplicateLikedTracks(user.id, log);
            }
        });
    }

    async removeDuplicateLikedTracks(userDbId: number, log: log): Promise<void> {
        const duplicates = await db('liked_tracks')
            .select('track_id')
            .count('* as count')
            .where({user_id: userDbId})
            .groupBy('track_id')
            .havingRaw('COUNT(*) > 1');

        if (duplicates.length === 0) {
            return;
        }

        for (const dup of duplicates) {
            const records = await db('liked_tracks')
                .where({user_id: userDbId, track_id: dup.track_id})
                .orderBy('added_at', 'asc');

            const duplicateRecords = records.slice(1);
            if (duplicateRecords.length) {
                const idsToDelete = duplicateRecords.map(record => record.id);
                await db('liked_tracks')
                    .whereIn('id', idsToDelete)
                    .del();

                log(
                    `Removed duplicate entries for track ID ${dup.track_id} (deleted ${duplicateRecords.length} records).`,
                    'info'
                );
            }
        }
    }

    async insertNewTracksFromOffset(userId: string, total: number, log: log): Promise<boolean> {
        const savedTrackIds = new Set(
            (await db('liked_tracks')
                    .join('tracks', 'liked_tracks.track_id', 'tracks.id')
                    .where({'liked_tracks.user_id': (await this.getUserFromDb(userId)).id})
                    .select('tracks.track_id')
            ).map(record => record.track_id)
        );

        let offset = 0;
        let firstDuplicateFound = false;
        while (offset < total) {
            const options: PaginationOptions = {limit: 50, offset};
            const spotifyResponse = await this.getSavedTracks(userId, options);
            const currentTotal = spotifyResponse.total;

            const unsavedTracks: SpotifyApi.SavedTrackObject[] = [];
            for (const item of spotifyResponse.items) {
                const spotifyTrackId = item.track.id;
                if (savedTrackIds.has(spotifyTrackId)) {
                    firstDuplicateFound = true;
                    log(`Duplicate found for track ID ${spotifyTrackId}, stopping batch insertion.`, 'success');
                    const dbLikedTracksCount = await this.getDbLikedTracksCount((await this.getUserFromDb(userId)).id);
                    if (dbLikedTracksCount < currentTotal) {
                        log('Continuing to process the rest of the tracks...', 'info');
                        await this.continueProcessingTracks(await this.getUserFromDb(userId), userId, log);
                    }
                    break;
                }
                unsavedTracks.push(item);
            }

            if (unsavedTracks.length > 0) {
                log(`Inserting ${unsavedTracks.length} new tracks into the database...`, 'info');
                await this.insertSavedTracks(userId, unsavedTracks);
                unsavedTracks.forEach(item => savedTrackIds.add(item.track.id));
            }

            if (firstDuplicateFound) {
                return true;
            }
            offset += options.limit ?? 50;
            if (offset >= currentTotal) break;
        }
        return false;
    }

    async continueProcessingTracks(user: { id: number }, userId: string, log: log): Promise<void> {
        let offset = await this.getDbLikedTracksCount(user.id);
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
                // Insert tracks without further duplicate-checking here.
                await this.insertSavedTracks(userId, response.items);
                log(`Processed ${Math.min(offset + (options.limit ?? 50), total)} out of ${total} tracks from Spotify.`, 'update-success');
            }
            offset += options.limit ?? 50;
        }
        log('All tracks processed.', 'update-success');
    }

    async insertSavedTracks(userId: string, savedTracks: SpotifyApi.SavedTrackObject[]): Promise<void> {
        return this.handler(userId, async () => {
            const uniqueArtistIds = Array.from(new Set(savedTracks.map(track => track.track.artists[0].id)));

            const artistDetailsList: SpotifyApi.ArtistObjectFull[] = [];
            for (let i = 0; i < uniqueArtistIds.length; i += 50) {
                const batch = uniqueArtistIds.slice(i, i + 50);
                const {body: {artists}} = await this.spotifyApi.getArtists(batch);
                artistDetailsList.push(...artists);
            }

            const artistDetailsMap = new Map(artistDetailsList.map(artist => [artist.id, artist]));
            const userRecord = await db('users').where({user_id: userId}).select('id').first();
            if (!userRecord) throw new Error(`User with ID ${userId} not found`);
            const userIntId = userRecord.id;

            for (const track of savedTracks) {
                const artist = track.track.artists[0];
                const artistDetails = artistDetailsMap.get(artist.id);
                const genres = artistDetails?.genres || [];

                await insertArtist(artist.id, artist.name);

                for (const genre of genres) {
                    await insertGenre(genre);
                    const genreId = (await db('genres').where({genre}).select('id').first()).id;
                    const artistId = (await db('artists').where({artist_id: artist.id}).select('id').first()).id;
                    await insertArtistGenre(artistId, genreId);
                }

                const artistId = (await db('artists').where({artist_id: artist.id}).select('id').first()).id;
                await insertTrack(track.track.id, track.track.name, artistId);
                const trackId = (await db('tracks').where({track_id: track.track.id}).select('id').first()).id;
                await insertLikedTrack(userIntId, trackId, track.added_at);
            }
        });
    }
}

export default Spotify;