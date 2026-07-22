import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import corsMiddleware from '@/middlewares/cors';
import { errorHandler, notFoundHandler } from '@/middlewares/errors';
import authRoutes from '@/routes/auth.routes';
import meRoutes from '@/routes/me.routes';
import playerRoutes from '@/routes/player.routes';
import playlistRoutes from '@/routes/playlists.routes';
import catalogRoutes from '@/routes/catalog.routes';

export function createApp(): express.Express {
    const app = express();
    app.use(corsMiddleware);
    app.use(express.json());

    app.get('/api', (_req, res) => {
        res.status(200).json({ name: 'Vibify API', version: 2 });
    });

    app.use('/auth', authRoutes);
    app.use('/me/player', playerRoutes);
    app.use('/me', meRoutes);
    app.use('/', playlistRoutes);
    app.use('/', catalogRoutes);

    const webDist = path.resolve(process.cwd(), 'web/dist');
    if (fs.existsSync(webDist)) {
        app.use(express.static(webDist));
        app.get(/^\/(?!auth|me|playlists|api).*/, (_req, res) => {
            res.sendFile(path.join(webDist, 'index.html'));
        });
    }

    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
