/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
    return knex.schema.alterTable('users', table => {
        table.text('scopes').nullable();
        table.unique('api_token', { indexName: 'users_api_token_unique' });
    });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
    return knex.schema.alterTable('users', table => {
        table.dropUnique('api_token', 'users_api_token_unique');
        table.dropColumn('scopes');
    });
}
