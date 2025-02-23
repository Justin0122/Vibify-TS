import Spotify from "@/Vibify/Spotify";
import GenreService from "@/Vibify/Genre/genre.service";

class Genre {
    private genreService: GenreService;

    constructor(spotify: Spotify) {
        this.genreService = new GenreService(spotify);
    }

    async processGenre(genre: string, artistId: string): Promise<void> {
        return this.genreService.processGenre(genre, artistId);
    }
}

export default Genre;
