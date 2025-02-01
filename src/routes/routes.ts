import express, {Request, Response} from 'express';
import Spotify from '@/services/Spotify';
import authenticateApiKey from '@/middlewares/authenticateApiKey';
import catchErrors from '@/middlewares/catchErrors';
import redisCache from '@/middlewares/redisCache';
import {PaginationOptions, RecommendationsOptions, SpotifyAuthorizationResponse} from '@/types/spotify';

const router = express.Router();
const spotify = new Spotify();

router.get("/", (_req: Request, res: Response) => {
    res.status(200).json({message: "Vibify API is running"});
});

router.get('/authorize/:userId', catchErrors(async (req: Request, res: Response) => {
    const url = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=user-read-email%20user-read-private%20user-library-read%20user-top-read%20user-read-recently-played%20user-read-currently-playing%20user-follow-read%20playlist-read-private%20playlist-modify-public%20playlist-modify-private%20playlist-read-collaborative%20user-library-modify&state=${req.params.userId}`;
    res.redirect(url);
}));

router.get('/callback', catchErrors(async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    try {
        const {
            api_token,
            userId
        }: SpotifyAuthorizationResponse = await spotify.authorizationCodeGrant(code, (state as string).replace('%', ''));
        res.redirect(`${process.env.REDIRECT_URI}/dashboard?userId=${userId}&api_token=${api_token}`);
    } catch (err) {
        res.status(500).json({error: (err as Error).message});
    }
}));

router.get('/user/:id', authenticateApiKey, redisCache, catchErrors(async (req: Request, res: Response) => {
    const user = await spotify.getSpotifyUser(req.params.id);
    res.status(200).json(user);
}));

router.get('/user/delete/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    await spotify.deleteUser(req.params.id);
    res.status(200).json({message: 'User deleted'});
}));

router.get('/playlists/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    const playlists = await spotify.getSpotifyPlaylists(req.params.id, options);
    res.status(200).json(playlists);
}));

router.get('/playlist/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const playlist = await spotify.getSpotifyPlaylist(req.params.id, req.query.playlistId as string);
    res.status(200).json(playlist);
}));

router.get('/top/artists/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    const artists = await spotify.getTopArtists(req.params.id, options);
    res.status(200).json(artists);
}));

router.get('/top/tracks/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    const tracks = await spotify.getTopTracks(req.params.id, options);
    res.status(200).json(tracks);
}));

router.get('/recently-played/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        after: req.query.after ? parseInt(req.query.after as string) : undefined,
        before: req.query.before ? parseInt(req.query.before as string) : undefined,
    };
    const tracks = await spotify.getRecentlyPlayedTracks(req.params.id, options);
    res.status(200).json(tracks);
}));

router.get('/currently-playing/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const track = await spotify.getCurrentPlayback(req.params.id);
    res.status(200).json(track);
}));

/**
 * @deprecated As of November 27, 2024, Spotify has removed the Recommendations feature from their Web API.
 * This endpoint will no longer function but is kept here for if the feature is ever re-added.
 * For more information, please refer to the official Spotify Developer Blog:
 * @see https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
 */
router.get('/recommendations/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    res.status(501).json({error: 'This feature has been deprecated by Spotify'});
    const options: RecommendationsOptions = {
        seedArtists: req.query.seed_artists ? (req.query.seed_artists as string).split(',') : [],
        seedGenres: req.query.seed_genres ? (req.query.seed_genres as string).split(',') : [],
        seedTracks: req.query.seed_tracks ? (req.query.seed_tracks as string).split(',') : [],
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        market: req.query.market as string,
        likedTracks: req.query.likedTracks ? JSON.parse(req.query.likedTracks as string) : undefined,
        recentTracks: req.query.recentTracks ? JSON.parse(req.query.recentTracks as string) : undefined,
        topTracks: req.query.topTracks ? JSON.parse(req.query.topTracks as string) : undefined,
        topArtists: req.query.topArtists ? JSON.parse(req.query.topArtists as string) : undefined,
        currentlyPlaying: req.query.currentlyPlaying ? JSON.parse(req.query.currentlyPlaying as string) : undefined,
    };

    const recommendations = await spotify.getRecommendations(req.params.id, options);
    res.status(200).json(recommendations);
}));

router.get('/save-liked-tracks/:id', authenticateApiKey, catchErrors(async (req: Request, res: Response) => {
    const savedTracks = await spotify.saveLikedTracks(req.params.id);
    res.status(200).json(savedTracks);
}));

export default router;