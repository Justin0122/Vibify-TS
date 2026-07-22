import { getClient } from '@/spotify/client';
import { Artist, ItemTypes, MaxInt, Page, SearchResults, SimplifiedAlbum } from '@spotify/web-api-ts-sdk';

export async function search(
    userId: string,
    query: string,
    types: ItemTypes[],
    limit: MaxInt<50>,
    offset: number,
): Promise<SearchResults<ItemTypes[]>> {
    const client = await getClient(userId);
    return client.search(query, types, undefined, limit, offset);
}

export async function getArtist(userId: string, artistId: string): Promise<Artist> {
    const client = await getClient(userId);
    return client.artists.get(artistId);
}

export async function getArtistAlbums(userId: string, artistId: string, limit: MaxInt<50>, offset: number): Promise<Page<SimplifiedAlbum>> {
    const client = await getClient(userId);
    return client.artists.albums(artistId, undefined, undefined, limit, offset);
}

// Feb 2026 dev-mode API: /me/library takes uris as query param, body form 400s
const toTrackUris = (trackIds: string[]) =>
    trackIds.map(id => (id.startsWith('spotify:') ? id : `spotify:track:${id}`)).join(',');

export async function saveTracks(userId: string, trackIds: string[]): Promise<void> {
    const client = await getClient(userId);
    await client.makeRequest('PUT', `me/library?uris=${encodeURIComponent(toTrackUris(trackIds))}`);
}

export async function removeSavedTracks(userId: string, trackIds: string[]): Promise<void> {
    const client = await getClient(userId);
    await client.makeRequest('DELETE', `me/library?uris=${encodeURIComponent(toTrackUris(trackIds))}`);
}

export async function hasSavedTracks(userId: string, trackIds: string[]): Promise<boolean[]> {
    const client = await getClient(userId);
    return client.makeRequest<boolean[]>('GET', `me/library/contains?uris=${encodeURIComponent(toTrackUris(trackIds))}`);
}
