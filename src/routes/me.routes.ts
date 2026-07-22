import { Response, Router } from 'express';
import { asyncHandler, AppError } from '@/middlewares/errors';
import authenticate, { AuthedRequest } from '@/middlewares/auth';
import { cache } from '@/middlewares/cache';
import * as userService from '@/services/user.service';
import * as trackService from '@/services/track.service';
import * as artistService from '@/services/artist.service';
import * as syncService from '@/services/sync.service';
import * as catalog from '@/services/catalog.service';
import { MaxInt } from '@spotify/web-api-ts-sdk';

const router = Router();
router.use(authenticate);

export function pagination(req: AuthedRequest): trackService.Pagination {
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 50) as MaxInt<50>;
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10) || 0, 0);
    return { limit, offset };
}

function timeRange(req: AuthedRequest): trackService.TimeRange {
    const value = req.query.time_range as string | undefined;
    if (!value) return 'medium_term';
    if (value !== 'short_term' && value !== 'medium_term' && value !== 'long_term') {
        throw new AppError(400, 'time_range must be short_term, medium_term or long_term');
    }
    return value;
}

router.get(
    '/',
    cache(300),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await userService.getProfile(req.user!.user_id));
    }),
);

router.delete(
    '/',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        await userService.deleteUser(req.user!.user_id);
        res.status(204).end();
    }),
);

router.get(
    '/top/tracks',
    cache(300),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await trackService.getTopTracks(req.user!.user_id, pagination(req), timeRange(req)));
    }),
);

router.get(
    '/top/artists',
    cache(300),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await artistService.getTopArtists(req.user!.user_id, pagination(req), timeRange(req)));
    }),
);

router.get(
    '/tracks',
    cache(60),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await trackService.getSavedTracks(req.user!.user_id, pagination(req)));
    }),
);

router.get(
    '/tracks/recent',
    cache(60),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        const { limit } = pagination(req);
        const after = req.query.after ? parseInt(req.query.after as string, 10) : undefined;
        const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
        res.json(await trackService.getRecentlyPlayed(req.user!.user_id, limit, after, before));
    }),
);

router.get(
    '/tracks/years',
    cache(300),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await trackService.getLikedYears(req.user!.user_id));
    }),
);

router.get(
    '/tracks/years/:year/months',
    cache(300),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        const year = parseInt(String(req.params.year), 10);
        if (!year) throw new AppError(400, 'Invalid year');
        res.json(await trackService.getLikedMonths(req.user!.user_id, year));
    }),
);

router.get(
    '/tracks/contains',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        const ids = ((req.query.ids as string) || '').split(',').filter(Boolean);
        if (!ids.length) throw new AppError(400, 'ids required (comma-separated)');
        res.json(await catalog.hasSavedTracks(req.user!.user_id, ids));
    }),
);

router.put(
    '/tracks/:trackId',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        await catalog.saveTracks(req.user!.user_id, [String(req.params.trackId)]);
        res.status(204).end();
    }),
);

router.delete(
    '/tracks/:trackId',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        await catalog.removeSavedTracks(req.user!.user_id, [String(req.params.trackId)]);
        res.status(204).end();
    }),
);

router.post(
    '/tracks/sync',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        const started = await syncService.startSync(req.user!.user_id);
        res.status(202).json({ started, message: started ? 'Sync started' : 'Sync already running' });
    }),
);

router.get(
    '/tracks/sync/status',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
        res.json(await syncService.getStatus(req.user!.user_id));
    }),
);

export default router;
