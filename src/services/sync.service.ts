import db from '@/db/database';
import redis from '@/redisClient';
import { getClient } from '@/spotify/client';
import { getDbId } from '@/services/user.service';
import { getArtistDetailsMap, insertArtist } from '@/services/artist.service';
import { processGenre } from '@/services/genre.service';
import { SavedTrack } from '@spotify/web-api-ts-sdk';

export interface SyncStatus {
    state: 'idle' | 'running' | 'done' | 'error';
    processed: number;
    total: number;
    message?: string;
}

const STATUS_TTL_SECONDS = 3600;
const statusKey = (userId: string) => `sync:${userId}`;

async function setStatus(userId: string, status: SyncStatus): Promise<void> {
    await redis.setex(statusKey(userId), STATUS_TTL_SECONDS, JSON.stringify(status));
}

export async function getStatus(userId: string): Promise<SyncStatus> {
    const raw = await redis.get(statusKey(userId));
    return raw ? JSON.parse(raw) : { state: 'idle', processed: 0, total: 0 };
}

export async function startSync(userId: string): Promise<boolean> {
    const current = await getStatus(userId);
    if (current.state === 'running') return false;
    await setStatus(userId, { state: 'running', processed: 0, total: 0 });

    void runSync(userId).catch(async err => {
        await setStatus(userId, { state: 'error', processed: 0, total: 0, message: (err as Error).message });
    });
    return true;
}

async function runSync(userId: string): Promise<void> {
    const userDbId = await getDbId(userId);

    // Fresh client per call: long syncs outlive the access token (see src/spotify/client.ts)
    const firstPage = await (await getClient(userId)).currentUser.tracks.savedTracks(1, 0);
    const total = firstPage.total;
    const inDbResult = await db('liked_tracks').where({ user_id: userDbId }).count({ count: '*' }).first();
    const inDb = Number(inDbResult?.count ?? 0);
    const missing = total - inDb;

    if (missing <= 0) {
        await setStatus(userId, { state: 'done', processed: 0, total: 0, message: 'Already up to date' });
        return;
    }

    let processed = 0;
    for (let offset = 0; processed < missing; offset += 50) {
        const page = await (await getClient(userId)).currentUser.tracks.savedTracks(50, offset);
        if (page.items.length === 0) break;
        const fresh = await filterNew(userDbId, page.items);
        if (fresh.length > 0) {
            await insertSavedTracks(userId, userDbId, fresh);
            processed += fresh.length;
            await setStatus(userId, { state: 'running', processed, total: missing });
        }
        if (!page.next) break;
        // pacing: bursts trigger Spotify 5xx
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    await setStatus(userId, { state: 'done', processed, total: missing });
}

async function filterNew(userDbId: number, items: SavedTrack[]): Promise<SavedTrack[]> {
    const spotifyIds = items.map(item => item.track.id);
    const known: string[] = await db('liked_tracks')
        .join('tracks', 'liked_tracks.track_id', 'tracks.id')
        .where('liked_tracks.user_id', userDbId)
        .whereIn('tracks.track_id', spotifyIds)
        .pluck('tracks.track_id');
    const knownSet = new Set(known);
    return items.filter(item => !knownSet.has(item.track.id));
}

async function insertSavedTracks(userId: string, userDbId: number, items: SavedTrack[]): Promise<void> {
    const uniqueArtistIds = Array.from(new Set(items.map(item => item.track.artists[0].id)));
    const artistDetails = await getArtistDetailsMap(userId, uniqueArtistIds);

    for (const item of items) {
        const artist = item.track.artists[0];
        await insertArtist(artist.id, artist.name);
        for (const genre of artistDetails.get(artist.id)?.genres ?? []) {
            await processGenre(genre, artist.id);
        }
        const artistRow = await db('artists').where({ artist_id: artist.id }).select('id').first();
        await db('tracks')
            .insert({ track_id: item.track.id, name: item.track.name, artist_id: artistRow.id })
            .onConflict('track_id')
            .ignore();
        const trackRow = await db('tracks').where({ track_id: item.track.id }).select('id').first();
        const added = new Date(item.added_at);
        await db('liked_tracks').insert({
            user_id: userDbId,
            track_id: trackRow.id,
            added_at: item.added_at,
            year: added.getFullYear(),
            month: added.getMonth() + 1,
        });
    }
}
