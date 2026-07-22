import Redis from 'ioredis';
import config from '@/config';

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
});

export default redis;
