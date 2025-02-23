import {PaginationOptions, log} from '@/types/spotify';
import Spotify from "@/Vibify/Spotify";
import ArtistService from "@/Vibify/Artist/artist.service";

class Artist {
    private artistService: ArtistService;

    constructor(spotify: Spotify) {
        this.artistService = new ArtistService(spotify);
    }

    async getTopArtists(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopArtistsResponse> {
        return this.artistService.getTopArtists(userId, options, log, logImages);
    }

    async getArtistDetailsMap(uniqueArtistIds: string[]): Promise<Map<string, SpotifyApi.ArtistObjectFull>> {
        return this.artistService.getArtistDetailsMap(uniqueArtistIds);
    }

    async insertArtist(id: string, name: string) {
        return this.artistService.insertArtist(id, name);
    }
}

export default Artist;