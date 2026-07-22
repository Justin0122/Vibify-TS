import { getClient } from '@/spotify/client';
import { Page, Playlist, SimplifiedPlaylist, TrackItem, MaxInt } from '@spotify/web-api-ts-sdk';
import { Pagination, getLikedYears, getLikedMonths, getTracksFromPeriod } from '@/services/track.service';
import { AppError } from '@/middlewares/errors';

export async function getPlaylists(userId: string, { limit, offset }: Pagination): Promise<Page<SimplifiedPlaylist>> {
    const client = await getClient(userId);
    return client.currentUser.playlists.playlists(limit, offset);
}

export async function getPlaylist(userId: string, playlistId: string): Promise<Playlist<TrackItem>> {
    const client = await getClient(userId);
    return client.playlists.getPlaylist(playlistId);
}

export interface CreatePlaylistInput {
    name?: string;
    description?: string;
    isPublic?: boolean;
    month?: number;
    year?: number;
}

export interface CreatedPlaylist {
    id: string;
    name: string;
    url: string;
    trackCount: number;
    alreadyExisted: boolean;
}

async function findExistingByName(userId: string, name: string): Promise<SimplifiedPlaylist | undefined> {
    const pageSize: MaxInt<50> = 50;
    let offset = 0;
    for (;;) {
        const page = await getPlaylists(userId, { limit: pageSize, offset });
        const match = page.items.find(playlist => playlist.name === name);
        if (match) return match;
        offset += page.items.length;
        if (!page.next || page.items.length === 0) return undefined;
    }
}

export async function createPlaylist(userId: string, input: CreatePlaylistInput): Promise<CreatedPlaylist> {
    const monthly = input.month !== undefined && input.year !== undefined;
    let name = input.name;
    if (monthly) {
        const monthName = new Date(input.year!, input.month! - 1).toLocaleString('default', { month: 'short' });
        name = `Liked Songs from ${monthName} ${input.year}`;
    }
    if (!name) throw new AppError(400, 'Playlist name required (or provide month + year)');

    const existing = await findExistingByName(userId, name);
    if (existing) {
        // Feb 2026 API renamed playlist `tracks` field to `items`
        const itemsField = (existing as unknown as { items?: { total?: number } }).items;
        return {
            id: existing.id,
            name: existing.name,
            url: existing.external_urls.spotify,
            trackCount: itemsField?.total ?? existing.tracks?.total ?? 0,
            alreadyExisted: true,
        };
    }

    const tracks = monthly ? await getTracksFromPeriod(userId, input.month!, input.year!) : [];

    const client = await getClient(userId);
    // Feb 2026 API: SDK's /users/{id}/playlists is 403, must use /me/playlists
    const playlist = await client.makeRequest<Playlist<TrackItem>>('POST', 'me/playlists', {
        name,
        description: input.description ?? (monthly ? `Liked songs from ${name.replace('Liked Songs from ', '')}` : ''),
        public: input.isPublic ?? false,
    });

    if (tracks.length > 0) {
        await addTracksToPlaylist(userId, playlist.id, tracks.map(track => track.uri));
    }

    return {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls.spotify,
        trackCount: tracks.length,
        alreadyExisted: false,
    };
}

export async function createPlaylistsForAllMonths(userId: string): Promise<CreatedPlaylist[]> {
    const results: CreatedPlaylist[] = [];
    const years = await getLikedYears(userId);
    for (const year of years) {
        const months = await getLikedMonths(userId, year);
        for (const month of months) {
            results.push(await createPlaylist(userId, { month, year }));
        }
    }
    return results;
}

export async function addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[]): Promise<void> {
    const client = await getClient(userId);
    const batchSize = 50;
    for (let i = 0; i < trackIds.length; i += batchSize) {
        const batch = trackIds.slice(i, i + batchSize);
        // Feb 2026 API: SDK's /tracks path is 403, must use /items
        await client.makeRequest('POST', `playlists/${playlistId}/items`, {
            uris: batch.map(id => (id.startsWith('spotify:') ? id : `spotify:track:${id}`)),
        });
    }
}
