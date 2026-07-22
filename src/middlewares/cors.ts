import cors from 'cors';
import config from '@/config';

export default cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Application-Id', 'X-User-Id'],
});
