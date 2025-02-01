import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const db: Knex = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '7827',
        database: process.env.DB_NAME || 'vibify'
    },
});

export default db;