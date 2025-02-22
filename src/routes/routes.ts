import express, {Request, Response, NextFunction} from 'express';
import Spotify from '@/Vibify/Spotify';
import authenticateApiKey from '@/middlewares/authenticateApiKey';
import catchErrors from '@/middlewares/catchErrors';
import {log, PaginationOptions, SpotifyAuthorizationResponse} from '@/types/spotify';
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

const setOptions = (req: RequestWithLog, _res: Response, next: NextFunction) => {
    req.paginationOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        after: req.query.after ? parseInt(req.query.after as string) : undefined,
        before: req.query.before ? parseInt(req.query.before as string) : undefined,
    };
    if (req.query.sse === 'true') sseLoggingMiddleware(req, _res, next);
    else next();
};

interface RequestWithLog extends Request {
    log?: log;
    paginationOptions?: PaginationOptions;
}

const handleRoute = (handler: (req: RequestWithLog, res: Response, log: log) => Promise<unknown>) =>
    catchErrors(async (req: RequestWithLog, res: Response) => {
        const useSSE = req.query.sse === 'true';
        const log = useSSE && req.log ? req.log.bind(req) : () => {
        };
        try {
            const result = await handler(req, res, log);
            if (useSSE) res.end();
            else res.status(200).json(result);
        } catch (error) {
            if (useSSE) {
                log(`Error: ${(error as Error).message}`, 'error');
                res.end();
            } else {
                res.status(500).json({error: (error as Error).message});
            }
        }
    });

router.get('/save-liked-tracks/:id', authenticateApiKey, setOptions, handleRoute(async (req, _res, log) => {
    return await spotify.tracks.saveLikedTracks(req.params.id, log);
}));

router.get('/user/:id', authenticateApiKey, setOptions, handleRoute(async (req, _res, log) => {
    return await spotify.user.getSpotifyUser(req.params.id, log);
}));

const handlePaginationRoute = (handler: (req: RequestWithLog, res: Response, log: log, logImages: boolean) => Promise<unknown>) =>
    handleRoute(async (req: RequestWithLog, res: Response, log: log) => {
        const logImages = req.query.logimages !== undefined;
        return await handler(req, res, log, logImages);
    });

router.get('/playlists/:id', authenticateApiKey, setOptions, handleRoute(async (req: RequestWithLog) => {
    return await spotify.getSpotifyPlaylists(req.params.id, req.paginationOptions!);
}));

router.get('/top/artists/:id', authenticateApiKey, setOptions, handlePaginationRoute(async (req: RequestWithLog, _res: Response, log: log, logImages: boolean) => {
    return await spotify.artist.getTopArtists(req.params.id, req.paginationOptions!, log, logImages);
}));

router.get('/top/tracks/:id', authenticateApiKey, setOptions, handlePaginationRoute(async (req: RequestWithLog, _res: Response, log: log, logImages: boolean) => {
    return await spotify.tracks.getTopTracks(req.params.id, req.paginationOptions!, log, logImages);
}));

router.get('/recently-played/:id', authenticateApiKey, setOptions, handlePaginationRoute(async (req: RequestWithLog, _res: Response, log: log, logImages: boolean) => {
    return await spotify.tracks.getRecentlyPlayedTracks(req.params.id, req.paginationOptions!, log, logImages);
}));

router.get('/currently-playing/:id', authenticateApiKey, setOptions, handleRoute(async (req: RequestWithLog, _res: Response, log: log) => {
    return await spotify.tracks.getCurrentPlayback(req.params.id, log);
}));

export default router;