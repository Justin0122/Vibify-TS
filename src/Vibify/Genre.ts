import {insertArtistGenre, insertGenre} from "@/Vibify/Database";
import db from "@/db/database";

export async function processGenre(genre: string, artistId: string): Promise<void> {
    await insertGenre(genre);
    const genreId = (await db('genres').where({genre}).select('id').first()).id;
    const artistDbId = (await db('artists').where({artist_id: artistId}).select('id').first()).id;
    await insertArtistGenre(artistDbId, genreId);
}