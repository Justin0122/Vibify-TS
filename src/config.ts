import * as dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

const config = {
    spotify: {
        clientId: required('SPOTIFY_CLIENT_ID'),
        clientSecret: required('SPOTIFY_CLIENT_SECRET'),
        redirectUri: required('SPOTIFY_REDIRECT_URI'),
    },
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3333', 10),
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5432').replace(/\/$/, ''),
    corsOrigins: (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(origin => origin.trim().replace(/^\[?'?|'?\]?$/g, ''))
        .filter(Boolean),
    devMode: process.env.DEV_MODE === 'true',
    devUserId: process.env.DEV_USER_ID,
    applicationId: process.env.APPLICATION_ID,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        name: required('DB_NAME'),
        user: required('DB_USER'),
        password: required('DB_PASS'),
    },
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
};

export default config;
