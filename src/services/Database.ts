import db from '@/db/database';
import { User } from '@/types/spotify-stored';

export async function insertUserIntoDatabase(id: string, access_token: string, refresh_token: string, expires_in: number, api_token: string) {
    const expires_at = new Date(Date.now() + expires_in * 1000);
    const user: User = await db('users').where('user_id', id).first();
    if (user) {
        await db('users').where('user_id', id).update({
            access_token,
            refresh_token,
            expires_in,
            expires_at,
            api_token,
        });
    } else {
        await db('users').insert({
            user_id: id,
            access_token,
            refresh_token,
            expires_in,
            expires_at,
            api_token,
        });
    }
}

export async function deleteUserFromDatabase(id: string) {
    await db('users').where('user_id', id).del();
}