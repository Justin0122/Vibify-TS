import Spotify from "@/services/Spotify";
import {deleteUserFromDatabase} from "@/services/Database";
import {log} from "@/types/spotify";
import got from "got";
import imageType from "image-type";
import {Readable} from "stream";

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

export async function getSpotifyUser(
    this: Spotify,
    userId: string,
    log: log
): Promise<FormattedProfile> {
    return this.handler(userId, async () => {
        const spotifyProfile = await this.spotifyApi.getMe();

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


export async function deleteUser(this: Spotify, userId: string): Promise<void> {
    return this.handler(userId, async () => {
        await deleteUserFromDatabase(userId);
    });
}
