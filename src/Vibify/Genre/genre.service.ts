import Spotify from "@/Vibify/Spotify";
import db from "@/db/database";

class GenreService {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async processGenre(genre: string, artistId: string): Promise<void> {
        await this.insertGenre(genre);
        const genreId = (await db('genres').where({genre}).select('id').first()).id;
        const artistDbId = (await db('artists').where({artist_id: artistId}).select('id').first()).id;
        await this.insertArtistGenre(artistDbId, genreId);
    }

    private async insertGenre(genre: string) {
        await db('genres')
            .insert({genre})
            .onConflict('genre')
            .ignore();
    }

    private async insertArtistGenre(artistId: number, genreId: number) {
        await db('artist_genres')
            .insert({artist_id: artistId, genre_id: genreId})
            .onConflict(['artist_id', 'genre_id'])
            .ignore();
    }

}

export default GenreService;