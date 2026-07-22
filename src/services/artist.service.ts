import db from '@/db/database';
import { getClient } from '@/spotify/client';
import { Artist, Page, MaxInt } from '@spotify/web-api-ts-sdk';
import { Pagination, TimeRange } from '@/services/track.service';

export async function getTopArtists(userId: string, { limit, offset }: Pagination, timeRange: TimeRange = 'medium_term'): Promise<Page<Artist>> {
    const client = await getClient(userId);
    return client.currentUser.topItems('artists', timeRange, limit, offset);
}

// batch /artists?ids= is 403 for dev-mode apps — fetch one by one, best-effort
export async function getArtistDetailsMap(userId: string, artistIds: string[]): Promise<Map<string, Artist>> {
    const map = new Map<string, Artist>();
    const concurrency = 3;
    for (let i = 0; i < artistIds.length; i += concurrency) {
        const batch = artistIds.slice(i, i + concurrency);
        const results = await Promise.allSettled(batch.map(async id => (await getClient(userId)).artists.get(id)));
        for (const result of results) {
            if (result.status === 'fulfilled') map.set(result.value.id, result.value);
        }
    }
    return map;
}

export async function insertArtist(artistId: string, name: string): Promise<void> {
    await db('artists').insert({ artist_id: artistId, name }).onConflict('artist_id').ignore();
}

export type { MaxInt };
