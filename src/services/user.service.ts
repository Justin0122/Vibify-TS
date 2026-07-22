import db from '@/db/database';
import { getClient } from '@/spotify/client';
import { AppError } from '@/middlewares/errors';
import { UserProfile } from '@spotify/web-api-ts-sdk';

export interface FormattedProfile {
    userId: string;
    displayName?: string;
    email: string;
    country: string;
    product: string;
    followers?: number;
    externalUrl: string;
    profileImage: string | null;
    uri: string;
}

export async function getProfile(userId: string): Promise<FormattedProfile> {
    const client = await getClient(userId);
    const profile: UserProfile = await client.currentUser.profile();
    return {
        userId: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        country: profile.country,
        product: profile.product,
        followers: profile.followers?.total,
        externalUrl: profile.external_urls.spotify,
        profileImage: profile.images?.[0]?.url ?? null,
        uri: profile.uri,
    };
}

export async function getDbId(userId: string): Promise<number> {
    const user = await db('users').where({ user_id: userId }).select('id').first();
    if (!user) throw new AppError(404, `User ${userId} not found`, 'UNKNOWN_USER');
    return user.id;
}

export async function deleteUser(userId: string): Promise<void> {
    const deleted = await db('users').where('user_id', userId).del();
    if (!deleted) throw new AppError(404, `User ${userId} not found`, 'UNKNOWN_USER');
}
