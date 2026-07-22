import db from '@/db/database';
import { getClient } from '@/spotify/client';
import { getDbId } from '@/services/user.service';
import { Page, SavedTrack, Track, RecentlyPlayedTracksPage, PlaybackState, MaxInt } from '@spotify/web-api-ts-sdk';

export interface Pagination {
    limit: MaxInt<50>;
    offset: number;
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export async function getTopTracks(userId: string, { limit, offset }: Pagination, timeRange: TimeRange = 'medium_term'): Promise<Page<Track>> {
    const client = await getClient(userId);
    return client.currentUser.topItems('tracks', timeRange, limit, offset);
}

export async function getSavedTracks(userId: string, { limit, offset }: Pagination): Promise<Page<SavedTrack>> {
    const client = await getClient(userId);
    return client.currentUser.tracks.savedTracks(limit, offset);
}

export async function getRecentlyPlayed(userId: string, limit: MaxInt<50>, after?: number, before?: number): Promise<RecentlyPlayedTracksPage> {
    const client = await getClient(userId);
    const queryRange = after
        ? { type: 'after' as const, timestamp: after }
        : before
          ? { type: 'before' as const, timestamp: before }
          : undefined;
    return client.player.getRecentlyPlayedTracks(limit, queryRange);
}

export async function getCurrentlyPlaying(userId: string): Promise<PlaybackState | null> {
    const client = await getClient(userId);
    return (await client.player.getCurrentlyPlayingTrack()) ?? null;
}

export async function getLikedYears(userId: string): Promise<number[]> {
    const userDbId = await getDbId(userId);
    return db('liked_tracks').where({ user_id: userDbId }).distinct('year').orderBy('year', 'desc').pluck('year');
}

export async function getLikedMonths(userId: string, year: number): Promise<number[]> {
    const userDbId = await getDbId(userId);
    return db('liked_tracks').where({ user_id: userDbId, year }).distinct('month').orderBy('month', 'desc').pluck('month');
}

export interface PeriodTrack {
    uri: string;
    track_name: string;
    artist_name: string;
}

export async function getTracksFromPeriod(userId: string, month: number, year: number): Promise<PeriodTrack[]> {
    const userDbId = await getDbId(userId);
    return db('liked_tracks')
        .join('tracks', 'liked_tracks.track_id', 'tracks.id')
        .join('artists', 'tracks.artist_id', 'artists.id')
        .where({ user_id: userDbId, month, year })
        .select('tracks.track_id as uri', 'tracks.name as track_name', 'artists.name as artist_name');
}
