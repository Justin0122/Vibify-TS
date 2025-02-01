/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
    await knex.schema.createTable('tracks', table => {
        table.increments('id');
        table.string('track_id').notNullable().unique();
        table.string('name').notNullable();
        table.integer('artist_id').unsigned().notNullable().references('id').inTable('artists');
        table.integer('genre_id').unsigned().references('id').inTable('genres');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
    await knex.schema.dropTable('tracks');
};

