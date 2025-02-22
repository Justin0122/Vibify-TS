import db from '@/db/database';
import {User} from '@/types/spotify-stored';

export async function insertUserIntoDatabase(id: string, access_token: string, refresh_token: string, expires_in: number, api_token: string) {
    const expires_at = new Date(Date.now() + expires_in * 1000);
    const user: User = await db('users').where('user_id', id).first();
    if (user) {
        await db('users').where('user_id', id).update({
            access_token,
            refresh_token,
            expires_in,
            expires_at,
            api_token,
        });
    } else {
        await db('users').insert({
            user_id: id,
            access_token,
            refresh_token,
            expires_in,
            expires_at,
            api_token,
        });
    }
}

export async function deleteUserFromDatabase(id: string) {
    await db('users').where('user_id', id).del();
}

export async function insertArtist(artistId: string, name: string) {
    await db('artists')
        .insert({artist_id: artistId, name})
        .onConflict('artist_id')
        .ignore();
}

export async function insertGenre(genre: string) {
    await db('genres')
        .insert({genre})
        .onConflict('genre')
        .ignore();
}

export async function insertArtistGenre(artistId: number, genreId: number) {
    await db('artist_genres')
        .insert({artist_id: artistId, genre_id: genreId})
        .onConflict(['artist_id', 'genre_id'])
        .ignore();
}

export async function insertTrack(trackId: string, name: string, artistId: number) {
    await db('tracks')
        .insert({track_id: trackId, name, artist_id: artistId})
        .onConflict('track_id')
        .ignore();
}

export async function insertLikedTrack(userId: number, trackId: number, addedAt: string) {
    await db('liked_tracks').insert({
        user_id: userId,
        track_id: trackId,
        added_at: addedAt,
        year: new Date(addedAt).getFullYear(),
        month: new Date(addedAt).getMonth() + 1
    });
}