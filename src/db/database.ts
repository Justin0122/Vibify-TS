import knex, { Knex } from 'knex';
import config from '@/config';

const db: Knex = knex({
    client: 'mysql2',
    connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.name,
    },
});

export default db;
