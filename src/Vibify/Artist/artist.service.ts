import Spotify from "@/Vibify/Spotify";
import {log, PaginationOptions} from "@/types/spotify";
import db from "@/db/database";

class ArtistService {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getTopArtists(userId: string, options: PaginationOptions, log: log | null = null, logImages = false): Promise<SpotifyApi.UsersTopArtistsResponse> {
        return this.spotify.handler(userId, async () => {
            const topArtists = await this.spotify.spotifyApi.getMyTopArtists(options);
            if (log) {
                for (const artist of topArtists.body.items) {
                    await log(`Artist: ${artist.name}`, 'info');
                    if (artist.images.length > 0 && logImages) await log(artist.images[0].url, 'image');
                }
            }
            return topArtists.body;
        });
    }

    async getArtistDetailsMap(uniqueArtistIds: string[]): Promise<Map<string, SpotifyApi.ArtistObjectFull>> {
        const artistDetailsList: SpotifyApi.ArtistObjectFull[] = [];
        for (let i = 0; i < uniqueArtistIds.length; i += 50) {
            const batch = uniqueArtistIds.slice(i, i + 50);
            const artists = (await this.spotify.spotifyApi.getArtists(batch)).body.artists;
            artistDetailsList.push(...artists);
        }
        return new Map(artistDetailsList.map(artist => [artist.id, artist]));
    }

    async insertArtist(artistId: string, name: string) {
        await db('artists')
            .insert({artist_id: artistId, name})
            .onConflict('artist_id')
            .ignore();
    }
}

export default ArtistService;