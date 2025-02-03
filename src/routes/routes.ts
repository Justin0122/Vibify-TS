import express, {Request, Response, NextFunction} from 'express';
import Spotify from '@/services/Spotify';
import authenticateApiKey from '@/middlewares/authenticateApiKey';
import catchErrors from '@/middlewares/catchErrors';
import {log, PaginationOptions, RecommendationsOptions, SpotifyAuthorizationResponse} from '@/types/spotify';
import sseLoggingMiddleware from '@/middlewares/sseLogging';

const router = express.Router();
const spotify = new Spotify();

router.get("/", (_req: Request, res: Response) => {
    res.status(200).json({message: "Vibify API is running"});
});

router.get('/authorize/:userId', catchErrors(async (req: Request, res: Response) => {
    const url = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=user-library-read&state=${req.params.userId}`;
    res.redirect(url);
}));

router.get('/callback', catchErrors(async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    try {
        const {api_token, userId}: SpotifyAuthorizationResponse = await spotify.authorizationCodeGrant(code, state);
        res.redirect(`${process.env.REDIRECT_URI}/dashboard?userId=${userId}&api_token=${api_token}`);
    } catch (err) {
        res.status(500).json({error: (err as Error).message});
    }
}));

const optionalSSE = (req: Request, res: Response, next: NextFunction) => {
    if (req.query.sse === 'true') {
        sseLoggingMiddleware(req, res, next);
    } else {
        next();
    }
};

interface RequestWithLog extends Request {
    log?: log;
}

router.get('/save-liked-tracks/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const log = useSSE && req.log ? req.log.bind(req) : () => {
    };
    if (useSSE) log?.('Starting to process liked tracks...', 'start');

    try {
        const result = await spotify.saveLikedTracks(req.params.id, log as log);
        if (useSSE) {
            log?.('✅ Finished processing liked tracks!', 'update-start');
            res.end();
        } else {
            res.status(200).json(result);
        }
    } catch (error) {
        if (useSSE) {
            log?.(`Error: ${(error as Error).message}`, 'error');
            res.end();
        } else {
            res.status(500).json({error: (error as Error).message});
        }
    }
}));

router.get('/user/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const log = useSSE && req.log ? req.log.bind(req) : () => {
    };
    const user = await spotify.getSpotifyUser(req.params.id, log as log);
    if (useSSE && user) res.end();
    else res.status(200).json(user);
}));

router.get('/playlists/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const playlists = await spotify.getSpotifyPlaylists(req.params.id, options);

    if (!req.query.sse) res.status(200).json(playlists);
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


router.get('/top/artists/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    let logFunction;
    if (useSSE) logFunction = req.log?.bind(req);
    const logImages = req.query.logimages !== undefined;

    const artists = await spotify.getTopArtists(req.params.id, options, logFunction as log | null, logImages);
    if (!useSSE) res.status(200).json(artists);
    else res.end();
}));



router.get('/top/tracks/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    let logFunction;
    if (useSSE) logFunction = req.log?.bind(req);
    const logImages = req.query.logimages !== undefined;
    const tracks = await spotify.getTopTracks(req.params.id, options, logFunction as log | null, logImages);
    if (useSSE) res.end();
    else res.status(200).json(tracks);
}));

router.get('/recently-played/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const options: PaginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        after: req.query.after ? parseInt(req.query.after as string) : undefined,
        before: req.query.before ? parseInt(req.query.before as string) : undefined,
    };
    let logFunction;
    if (useSSE) logFunction = req.log?.bind(req);
    const logImages = req.query.logimages !== undefined;
    const tracks = await spotify.getRecentlyPlayedTracks(req.params.id, options, logFunction as log | null, logImages);
    if (useSSE) res.end();
    else res.status(200).json(tracks);
}));


router.get('/currently-playing/:id', authenticateApiKey, optionalSSE, catchErrors(async (req: RequestWithLog, res: Response) => {
    const useSSE = req.query.sse === 'true';
    const log = useSSE && req.log ? req.log.bind(req) : () => {
    };
    const playback = await spotify.getCurrentPlayback(req.params.id, log as log);
    if (useSSE) res.end();
    else res.status(200).json(playback);
}));

export default router;
