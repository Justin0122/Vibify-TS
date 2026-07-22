import db from '@/db/database';

export async function processGenre(genre: string, artistId: string): Promise<void> {
    await db('genres').insert({ genre }).onConflict('genre').ignore();
    const genreRow = await db('genres').where({ genre }).select('id').first();
    const artistRow = await db('artists').where({ artist_id: artistId }).select('id').first();
    if (!genreRow || !artistRow) return;
    await db('artist_genres')
        .insert({ artist_id: artistRow.id, genre_id: genreRow.id })
        .onConflict(['artist_id', 'genre_id'])
        .ignore();
}
