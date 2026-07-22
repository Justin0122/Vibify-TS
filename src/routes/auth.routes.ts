import { Router } from 'express';
import config from '@/config';
import { asyncHandler, AppError } from '@/middlewares/errors';
import authenticate, { AuthedRequest } from '@/middlewares/auth';
import * as authService from '@/services/auth.service';

const router = Router();

router.get('/authorize/:userId', (req, res) => {
    res.redirect(authService.buildAuthorizeUrl(req.params.userId));
});

router.get(
    '/callback',
    asyncHandler(async (req, res) => {
        const code = req.query.code as string | undefined;
        const state = req.query.state as string | undefined;
        if (!code || !state) throw new AppError(400, 'Missing code or state');
        const otc = await authService.handleCallback(code, state);
        res.redirect(`${config.frontendUrl}/login/callback?code=${otc}`);
    }),
);

router.post(
    '/exchange',
    asyncHandler(async (req, res) => {
        const { code } = req.body ?? {};
        if (!code) throw new AppError(400, 'Missing code');
        const { userId, apiToken } = await authService.redeemOneTimeCode(code);
        res.json({ userId, api_token: apiToken });
    }),
);

router.get(
    '/token',
    authenticate,
    asyncHandler(async (req: AuthedRequest, res) => {
        res.json(await authService.getPlaybackToken(req.user!.user_id));
    }),
);

export default router;
