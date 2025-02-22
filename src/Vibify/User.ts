import Spotify from "@/Vibify/Spotify";
import { deleteUserFromDatabase } from "@/Vibify/Database";
import { log } from "@/types/spotify";
import { Readable } from "stream";
import db from "@/db/database";

interface FormattedProfile {
    userId: string;
    displayName?: string;
    email: string;
    country: string;
    product: string;
    followers?: number;
    externalUrl: string;
    profileImage: string;
    birthdate: string;
    external_urls: SpotifyApi.ExternalUrlObject;
    href: string;
    id: string;
    type: "user";
    uri: string;
    imageStream?: Readable;
}

class User {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getSpotifyUser(userId: string, log: log): Promise<FormattedProfile> {
        return this.spotify.handler(userId, async () => {
            const spotifyProfile = await this.spotify.spotifyApi.getMe();

            const formattedProfile: FormattedProfile = {
                userId: spotifyProfile.body.id,
                displayName: spotifyProfile.body.display_name,
                email: spotifyProfile.body.email,
                country: spotifyProfile.body.country,
                product: spotifyProfile.body.product,
                followers: spotifyProfile.body.followers?.total,
                externalUrl: spotifyProfile.body.external_urls.spotify,
                profileImage: spotifyProfile.body.images?.[0]?.url || "No image available",
                birthdate: spotifyProfile.body.birthdate,
                external_urls: spotifyProfile.body.external_urls,
                href: spotifyProfile.body.href,
                id: spotifyProfile.body.id,
                type: spotifyProfile.body.type,
                uri: spotifyProfile.body.uri,
            };

            log(`User Profile: ${formattedProfile.displayName} (${formattedProfile.userId})`, "start");
            log(`Country: ${formattedProfile.country}`, "info");
            log(`Email: ${formattedProfile.email}`, "info");
            log(`Followers: ${formattedProfile.followers}`, "info");
            log(`Spotify URL: ${formattedProfile.externalUrl}`, "info");

            if (formattedProfile.profileImage !== "No image available" && formattedProfile.profileImage.startsWith("http")) {
                await log(formattedProfile.profileImage, "image");
            }

            return formattedProfile;
        });
    }

    async getFromDb(userId: string): Promise<{ id: number }> {
        const user = await db('users').where({ user_id: userId }).select('id').first();
        if (!user) throw new Error(`User with ID ${userId} not found`);
        return user;
    }

    async getId(userId: string): Promise<number> {
        const userRecord = await db('users').where({ user_id: userId }).select('id').first();
        if (!userRecord) throw new Error(`User with ID ${userId} not found`);
        return userRecord.id;
    }

    async deleteUser(userId: string): Promise<void> {
        return this.spotify.handler(userId, async () => {
            await deleteUserFromDatabase(userId);
        });
    }
}

export default User;