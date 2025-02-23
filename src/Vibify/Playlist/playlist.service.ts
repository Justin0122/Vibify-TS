import Spotify from "@/Vibify/Spotify";
import {log, MonthOptions, PaginationOptions} from "@/types/spotify";

class PlaylistService {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getSpotifyPlaylists(userId: string, options: PaginationOptions): Promise<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
        return this.spotify.handler(userId, async () => {
            const spotifyPlaylists = await this.spotify.spotifyApi.getUserPlaylists(options);
            return spotifyPlaylists.body as SpotifyApi.ListOfUsersPlaylistsResponse;
        });
    }

    async getSpotifyPlaylist(userId: string, playlistId: string): Promise<SpotifyApi.SinglePlaylistResponse> {
        return this.spotify.handler(userId, async () => {
            const spotifyPlaylist = await this.spotify.spotifyApi.getPlaylist(playlistId);
            return spotifyPlaylist.body;
        });
    }

    async createSpotifyPlaylist(userId: string, name: string, description: string, isPublic: boolean, monthOptions: MonthOptions, log: log | undefined): Promise<SpotifyApi.CreatePlaylistResponse> {
        if (monthOptions) {
            const monthName = new Date(monthOptions.year, monthOptions.month - 1).toLocaleString('default', {month: 'short'});
            name = `Liked Songs from ${monthName} ${monthOptions.year}`;
        }

        const existingPlaylists = await this.getSpotifyPlaylists(userId, {limit: 50});
        const totalPlaylists = existingPlaylists.total;

        while (existingPlaylists.items.length < totalPlaylists) {
            const additionalPlaylists = await this.getSpotifyPlaylists(userId, {
                limit: 50,
                offset: existingPlaylists.items.length
            });
            existingPlaylists.items = existingPlaylists.items.concat(additionalPlaylists.items);
        }

        const existingPlaylist = existingPlaylists.items.find(playlist => playlist.name === name);
        if (existingPlaylist) {
            if (log) {
                log(`Playlist already exists: ${name} url: ${existingPlaylist.external_urls.spotify}`, 'info');
                await log(existingPlaylist.images[0].url, 'image');
            }
            return existingPlaylist as SpotifyApi.CreatePlaylistResponse;
        }

        const songs = monthOptions ? await this.spotify.tracks.getTracksFromPeriod(userId, monthOptions) : [];

        const playlist = await this.spotify.handler(userId, async () => {
            const spotifyPlaylist = await this.spotify.spotifyApi.createPlaylist(name, {description, public: isPublic});
            if (log) log(`Created playlist: ${name}`, 'info');
            return spotifyPlaylist.body;
        });

        if (!playlist) throw new Error('Failed to create playlist');

        if (songs.length) {
            try {
                await this.addTracksToPlaylist(userId, playlist.id, songs.map(song => song.uri), log);
            } catch (err: unknown) {
                if (err instanceof Error && log) log(`Error adding tracks to playlist: ${err.message}`, 'error');
            }
        }
        return playlist;
    }

    async createSpotifyPlaylistForAllMonths(userId: string, log: log | undefined): Promise<void> {
        const years = await this.spotify.tracks.getLikedYears(userId);
        for (const year of years) {
            const months = await this.spotify.tracks.getLikedMonths(userId, year);
            for (const month of months) {
                const monthOptions = {month, year};
                await this.createSpotifyPlaylist(userId, '', '', false, monthOptions, log);
            }
        }
    }

    async addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[], log: log | undefined): Promise<void> {
        return this.spotify.handler(userId, async () => {
            const batchSize = 50;
            for (let i = 0; i < trackIds.length; i += batchSize) {
                const batch = trackIds.slice(i, i + batchSize);
                await this.spotify.spotifyApi.addTracksToPlaylist(playlistId, batch.map(id => `spotify:track:${id}`));
                if (log) log(`Added ${i + batch.length} of ${trackIds.length} tracks to playlist`, 'info');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        });
    }
}

export default PlaylistService;