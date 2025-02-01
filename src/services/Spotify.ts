import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import chalk from 'chalk';
import {setSpotifyTokens, getSpotifyTokens, tokenHandler, refreshAccessToken} from './Tokens';
import {authorizationCodeGrant} from './Authorization';
import {getSpotifyUser} from './User';
import {getSpotifyPlaylists, getSpotifyPlaylist} from './Playlist';
import {deleteUserFromDatabase} from '@/services/Database';
import {PaginationOptions, RecommendationsOptions} from '@/types/spotify';
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

    async getTopArtists(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersTopArtistsResponse> {
        return this.handler(userId, async () => {
            const topArtists = await this.spotifyApi.getMyTopArtists(options);
            return topArtists.body;
        });
    }

    async getTopTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersTopTracksResponse> {
        return this.handler(userId, async () => {
            const topTracks = await this.spotifyApi.getMyTopTracks(options);
            return topTracks.body;
        });
    }

    async getSavedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersSavedTracksResponse> {
        return this.handler(userId, async () => {
            const savedTracks = await this.spotifyApi.getMySavedTracks(options);
            return savedTracks.body;
        });
    }

    async getRecentlyPlayedTracks(userId: string, options: PaginationOptions): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse> {
        return this.handler(userId, async () => {
            const recentlyPlayedTracks = await this.spotifyApi.getMyRecentlyPlayedTracks(options);
            return recentlyPlayedTracks.body;
        });
    }

    async getCurrentPlayback(userId: string): Promise<SpotifyApi.CurrentlyPlayingResponse> {
        return this.handler(userId, async () => {
            const currentPlayback = await this.spotifyApi.getMyCurrentPlayingTrack();
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

    async saveLikedTracks(userId: string, log: (message: string) => void): Promise<void> {
        const user = await db('users')
            .where({ user_id: userId })
            .select('id')
            .first();

        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        // Get count of liked tracks already saved
        const countResult = await db('liked_tracks')
            .where({ user_id: user.id })
            .count('* as count')
            .first();
        let savedTracksCount = Number(countResult?.count ?? 0);

        log(`Starting offset set to ${savedTracksCount} based on already saved tracks.`);

        // Fetch the actual total count from Spotify
        const initialTracksResponse = await this.getSavedTracks(userId, { limit: 1, offset: 0 });
        let total = initialTracksResponse.total;
        log(`Spotify reports ${total} total liked tracks.`);

        if (total === countResult?.count) {
            log('No new tracks found.');
            return;
        }

        const savedTrackIds = new Set(
            (await db('liked_tracks')
                    .join('tracks', 'liked_tracks.track_id', 'tracks.id')
                    .where({ 'liked_tracks.user_id': user.id })
                    .select('tracks.track_id')
            ).map(record => record.track_id)
        );

        let offset = 0;
        let firstDuplicateFound = false;
        const allNewTracks: SpotifyApi.SavedTrackObject[] = [];

        while (offset < total) {
            const options: PaginationOptions = { limit: 50, offset };
            const limit = options.limit ?? 50;
            const savedTracksResponse = await this.getSavedTracks(userId, options);
            total = savedTracksResponse.total;

            const unsavedTracks: SpotifyApi.SavedTrackObject[] = [];

            for (const track of savedTracksResponse.items) {
                if (savedTrackIds.has(track.track.id)) {
                    firstDuplicateFound = true;
                    break;
                }
                unsavedTracks.push(track);
            }

            if (unsavedTracks.length > 0) {
                log(`Found ${unsavedTracks.length} new tracks.`);
                allNewTracks.push(...unsavedTracks);
            }

            if (firstDuplicateFound) {
                log(`First duplicate found. Updating offset to database count and inserting new tracks.`);
                break;
            }

            offset += limit;
        }

        if (allNewTracks.length > 0) {
            log(`Inserting ${allNewTracks.length} new tracks into the database...`);
            await this.insertSavedTracks(userId, allNewTracks);
        }

        // Update offset to database count after inserting new tracks
        const updatedCountResult = await db('liked_tracks')
            .where({ user_id: user.id })
            .count('* as count')
            .first();
        savedTracksCount = Number(updatedCountResult?.count ?? savedTracksCount);
        offset = savedTracksCount;
        log(`Continuing from offset: ${offset}`);

        while (offset < total) {
            const options: PaginationOptions = { limit: 50, offset };
            const limit = options.limit ?? 50;
            const savedTracksResponse = await this.getSavedTracks(userId, options);
            await this.insertSavedTracks(userId, savedTracksResponse.items);
            total = savedTracksResponse.total;

            log(`Processed ${Math.min(offset + limit, total)} out of ${total} tracks from Spotify.`);
            offset += limit;
        }
    }

    async insertSavedTracks(userId: string, savedTracks: SpotifyApi.SavedTrackObject[]): Promise<void> {
        const artistIds = savedTracks.map(track => track.track.artists[0].id);
        const uniqueArtistIds = Array.from(new Set(artistIds));

        // Fetch artist details in batches of 50
        const artistDetailsList: SpotifyApi.ArtistObjectFull[] = [];
        for (let i = 0; i < uniqueArtistIds.length; i += 50) {
            const batch = uniqueArtistIds.slice(i, i + 50);
            const artistDetailsResponse = await this.spotifyApi.getArtists(batch);
            artistDetailsList.push(...artistDetailsResponse.body.artists);
        }

        const artistDetailsMap = new Map(artistDetailsList.map(artist => [artist.id, artist]));

        // Get the integer user ID from the database
        const userRecord = await db('users').where({user_id: userId}).select('id').first();
        if (!userRecord) {
            throw new Error(`User with ID ${userId} not found`);
        }
        const userIntId = userRecord.id;

        for (const track of savedTracks) {
            const artist = track.track.artists[0];
            const artistDetails = artistDetailsMap.get(artist.id);
            const genres = artistDetails ? artistDetails.genres : [];

            // Insert artist if not exists
            await db('artists')
                .insert({artist_id: artist.id, name: artist.name})
                .onConflict('artist_id')
                .ignore();

            // Insert genres and artist-genre relationships
            for (const genre of genres) {
                await db('genres')
                    .insert({genre})
                    .onConflict('genre')
                    .ignore();

                const genreId = await db('genres')
                    .where({genre})
                    .select('id')
                    .first();

                const artistId = await db('artists')
                    .where({artist_id: artist.id})
                    .select('id')
                    .first();

                await db('artist_genres')
                    .insert({
                        artist_id: artistId.id,
                        genre_id: genreId.id
                    })
                    .onConflict(['artist_id', 'genre_id'])
                    .ignore();
            }

            // Insert track
            await db('tracks')
                .insert({
                    track_id: track.track.id,
                    name: track.track.name,
                    artist_id: (await db('artists').where({artist_id: artist.id}).select('id').first()).id
                })
                .onConflict('track_id')
                .ignore();

            const trackId = await db('tracks')
                .where({track_id: track.track.id})
                .select('id')
                .first();

            // Insert liked track
            await db('liked_tracks').insert({
                user_id: userIntId, // Use the integer user ID
                track_id: trackId.id,
                added_at: track.added_at,
                year: new Date(track.added_at).getFullYear(),
                month: new Date(track.added_at).getMonth() + 1
            });
        }
    }
}

export default Spotify;