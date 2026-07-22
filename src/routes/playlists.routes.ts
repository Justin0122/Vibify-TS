import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errors';
import authenticate, { AuthedRequest } from '@/middlewares/auth';
import { cache } from '@/middlewares/cache';
import * as playlistService from '@/services/playlist.service';
import { pagination } from '@/routes/me.routes';

const router = Router();

router.get(
    '/me/playlists',
    authenticate,
    cache(60),
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await playlistService.getPlaylists(req.user!.user_id, pagination(req)));
    }),
);

router.post(
    '/me/playlists',
    authenticate,
    asyncHandler(async (req: AuthedRequest, res) => {
        const { name, description, public: isPublic, month, year } = req.body ?? {};
        const created = await playlistService.createPlaylist(req.user!.user_id, {
            name,
            description,
            isPublic: isPublic === true || isPublic === 'true',
            month: month !== undefined ? parseInt(String(month), 10) : undefined,
            year: year !== undefined ? parseInt(String(year), 10) : undefined,
        });
        res.status(created.alreadyExisted ? 200 : 201).json(created);
    }),
);

router.post(
    '/me/playlists/monthly',
    authenticate,
    asyncHandler(async (req: AuthedRequest, res) => {
        res.status(201).json(await playlistService.createPlaylistsForAllMonths(req.user!.user_id));
    }),
);

router.get(
    '/playlists/:playlistId',
    authenticate,
    cache(60),
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await playlistService.getPlaylist(req.user!.user_id, String(req.params.playlistId)));
    }),
);

export default router;
