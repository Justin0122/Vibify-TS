import config from '@/config';
import { createApp } from '@/app';
import db from '@/db/database';
import redis from '@/redisClient';

const app = createApp();

if (config.devMode) {
    console.warn('⚠️  DEV_MODE is enabled: API key auth is BYPASSED. Do not expose this instance.');
    if (!config.devUserId) {
        console.warn('⚠️  DEV_MODE without DEV_USER_ID: requests without X-API-Key will be rejected.');
    }
}

try {
    await redis.ping();
    console.log(`Redis reachable at ${config.redis.host}:${config.redis.port}`);
} catch (err) {
    console.error(`Redis unreachable at ${config.redis.host}:${config.redis.port} — caching, auth handoff and sync jobs need it.`, err);
    process.exit(1);
}

const server = app.listen(config.port, config.host, () => {
    console.log(`Vibify API listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal: string) {
    console.log(`${signal} received, shutting down...`);
    server.close();
    await Promise.allSettled([db.destroy(), redis.quit()]);
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
