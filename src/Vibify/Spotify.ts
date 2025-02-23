import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import chalk from 'chalk';
import Track from "@/Vibify/Track/Track";
import Artist from "@/Vibify/Artist/Artist";
import User from "@/Vibify/User/User";
import Genre from "@/Vibify/Genre/Genre";
import TokenService from "@/Vibify/Tokens";

dotenv.config();

class Spotify {
    private readonly redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
    clientId = process.env.SPOTIFY_CLIENT_ID || '';
    clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    private isRateLimited = false;
    spotifyApi = new SpotifyWebApi({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri
    });
    private rateLimitPromise: Promise<void> | null = null;
    tracks: Track;
    artist: Artist;
    user: User
    genre: Genre;
    tokenHandlerService: TokenService;

    constructor() {
        this.tracks = new Track(this);
        this.artist = new Artist(this);
        this.user = new User(this)
        this.genre = new Genre(this);
        this.tokenHandlerService = new TokenService(this.spotifyApi);
    }

    private log(message: string): void {
        console.log(chalk.blue(`[Spotify] ${message}`));
    }

    async handler<T>(userId: string, action: () => Promise<T>): Promise<T> {
        await this.tokenHandlerService.tokenHandler(userId);
        try {
            return await action();
        } catch (err: unknown) {
            if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
                this.isRateLimited = true;
                this.log('Rate limited, waiting...');
                await this.rateLimitHandler();
                return this.handler(userId, action);
            }
            console.log(chalk.red('Error in handler'), err);
            this.log('Token expired, refreshing tokens...');
            await this.tokenHandlerService.tokenHandler(userId);
            return action();
        }
    }

    async rateLimitHandler(): Promise<void> {
        if (this.isRateLimited) {
            if (this.rateLimitPromise) await this.rateLimitPromise;
            this.rateLimitPromise = new Promise(resolve => setTimeout(() => {
                this.isRateLimited = false;
                resolve();
            }, 1000));
            await this.rateLimitPromise;
        }
    }
}

export default Spotify;