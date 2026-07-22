/**
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
    // Dedup before constraining: keep lowest id per (artist_id, genre_id) pair
    await knex.raw(`
        DELETE ag1 FROM artist_genres ag1
        INNER JOIN artist_genres ag2
            ON ag1.artist_id = ag2.artist_id
            AND ag1.genre_id = ag2.genre_id
            AND ag1.id > ag2.id
    `);
    await knex.schema.alterTable('artist_genres', table => {
        table.unique(['artist_id', 'genre_id'], { indexName: 'artist_genres_artist_genre_unique' });
    });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
    return knex.schema.alterTable('artist_genres', table => {
        table.dropUnique(['artist_id', 'genre_id'], 'artist_genres_artist_genre_unique');
    });
}
