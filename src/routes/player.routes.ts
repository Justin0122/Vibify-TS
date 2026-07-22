import { NextFunction, Response, Router } from 'express';
import { asyncHandler, AppError } from '@/middlewares/errors';
import authenticate, { AuthedRequest } from '@/middlewares/auth';
import { hasPlayerScopes } from '@/services/auth.service';
import * as player from '@/services/player.service';

const router = Router();
router.use(authenticate);

router.use((req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!hasPlayerScopes(req.user!.scopes)) {
        throw new AppError(401, 'Playback scopes missing — re-authorize via /auth/authorize/:userId', 'REAUTH_REQUIRED');
    }
    next();
});

const deviceId = (req: AuthedRequest) => (req.query.device_id as string) || undefined;

router.get(
    '/',
    asyncHandler(async (req: AuthedRequest, res) => {
        const state = await player.getPlaybackState(req.user!.user_id);
        res.json(state ?? { is_playing: false, device: null, item: null });
    }),
);

router.put(
    '/',
    asyncHandler(async (req: AuthedRequest, res) => {
        const { device_id, play } = req.body ?? {};
        const target = device_id ?? req.body?.device_ids?.[0];
        if (!target) throw new AppError(400, 'device_id required');
        await player.transferPlayback(req.user!.user_id, target, play);
        res.status(204).end();
    }),
);

router.get(
    '/devices',
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await player.getDevices(req.user!.user_id));
    }),
);

router.get(
    '/currently-playing',
    asyncHandler(async (req: AuthedRequest, res) => {
        const state = await player.getPlaybackState(req.user!.user_id);
        res.json(state ?? { is_playing: false, item: null });
    }),
);

router.put(
    '/play',
    asyncHandler(async (req: AuthedRequest, res) => {
        const { context_uri, uris, offset, position_ms } = req.body ?? {};
        await player.play(req.user!.user_id, { device_id: deviceId(req) ?? req.body?.device_id, context_uri, uris, offset, position_ms });
        res.status(204).end();
    }),
);

router.put(
    '/pause',
    asyncHandler(async (req: AuthedRequest, res) => {
        await player.pause(req.user!.user_id, deviceId(req));
        res.status(204).end();
    }),
);

router.post(
    '/next',
    asyncHandler(async (req: AuthedRequest, res) => {
        await player.next(req.user!.user_id, deviceId(req));
        res.status(204).end();
    }),
);

router.post(
    '/previous',
    asyncHandler(async (req: AuthedRequest, res) => {
        await player.previous(req.user!.user_id, deviceId(req));
        res.status(204).end();
    }),
);

router.put(
    '/seek',
    asyncHandler(async (req: AuthedRequest, res) => {
        const positionMs = parseInt(req.query.position_ms as string, 10);
        if (Number.isNaN(positionMs) || positionMs < 0) throw new AppError(400, 'position_ms required');
        await player.seek(req.user!.user_id, positionMs, deviceId(req));
        res.status(204).end();
    }),
);

router.put(
    '/shuffle',
    asyncHandler(async (req: AuthedRequest, res) => {
        const state = req.query.state as string;
        if (state !== 'true' && state !== 'false') throw new AppError(400, 'state must be true or false');
        await player.setShuffle(req.user!.user_id, state === 'true', deviceId(req));
        res.status(204).end();
    }),
);

router.put(
    '/repeat',
    asyncHandler(async (req: AuthedRequest, res) => {
        const state = req.query.state as string;
        if (state !== 'off' && state !== 'track' && state !== 'context') {
            throw new AppError(400, 'state must be off, track or context');
        }
        await player.setRepeat(req.user!.user_id, state, deviceId(req));
        res.status(204).end();
    }),
);

router.put(
    '/volume',
    asyncHandler(async (req: AuthedRequest, res) => {
        const volume = parseInt(req.query.volume_percent as string, 10);
        if (Number.isNaN(volume) || volume < 0 || volume > 100) throw new AppError(400, 'volume_percent must be 0-100');
        await player.setVolume(req.user!.user_id, volume, deviceId(req));
        res.status(204).end();
    }),
);

router.get(
    '/queue',
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await player.getQueue(req.user!.user_id));
    }),
);

router.post(
    '/queue',
    asyncHandler(async (req: AuthedRequest, res) => {
        const uri = (req.query.uri as string) || req.body?.uri;
        if (!uri) throw new AppError(400, 'uri required');
        await player.addToQueue(req.user!.user_id, uri, deviceId(req));
        res.status(204).end();
    }),
);

export default router;
