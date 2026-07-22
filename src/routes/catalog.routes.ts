import { Router } from 'express';
import { asyncHandler, AppError } from '@/middlewares/errors';
import authenticate, { AuthedRequest } from '@/middlewares/auth';
import { cache } from '@/middlewares/cache';
import * as catalog from '@/services/catalog.service';
import { pagination } from '@/routes/me.routes';
import { ItemTypes } from '@spotify/web-api-ts-sdk';

const router = Router();

const VALID_TYPES: ItemTypes[] = ['track', 'artist', 'album', 'playlist', 'show', 'episode', 'audiobook'];

router.get(
    '/search',
    authenticate,
    asyncHandler(async (req: AuthedRequest, res) => {
        const query = (req.query.q as string) || '';
        if (!query) throw new AppError(400, 'q required');
        const types = ((req.query.type as string) || 'track')
            .split(',')
            .map(type => type.trim()) as ItemTypes[];
        const invalid = types.filter(type => !VALID_TYPES.includes(type));
        if (invalid.length) throw new AppError(400, `Invalid type(s): ${invalid.join(', ')}`);
        const { limit, offset } = pagination(req);
        // Spotify dev-mode caps search limit at 10 (400 above)
        const searchLimit = Math.min(limit, 10) as typeof limit;
        res.json(await catalog.search(req.user!.user_id, query, types, searchLimit, offset));
    }),
);

router.get(
    '/artists/:artistId',
    authenticate,
    cache(300),
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await catalog.getArtist(req.user!.user_id, String(req.params.artistId)));
    }),
);

router.get(
    '/artists/:artistId/albums',
    authenticate,
    cache(300),
    asyncHandler(async (req: AuthedRequest, res) => {
        const { limit, offset } = pagination(req);
        res.json(await catalog.getArtistAlbums(req.user!.user_id, String(req.params.artistId), limit, offset));
    }),
);

export default router;
