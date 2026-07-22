/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
    return knex.schema.alterTable('users', table => {
        table.integer('expires_in').alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
    return knex.schema.alterTable('users', table => {
        table.string('expires_in').alter();
    });
}
