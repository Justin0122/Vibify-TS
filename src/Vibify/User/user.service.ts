import Spotify from "@/Vibify/Spotify";
import {log, SpotifyAuthorizationResponse} from "@/types/spotify";
import db from "@/db/database";
import {FormattedProfile, User} from "@/Vibify/User/user.types";
import crypto from "crypto";
import chalk from "chalk";
import SpotifyWebApi from "spotify-web-api-node";

class UserService {
    private spotify: Spotify;

    constructor(spotify: Spotify) {
        this.spotify = spotify;
    }

    async getSpotifyUser(userId: string, log: log | undefined): Promise<FormattedProfile> {
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

            if (log) {
                log(`User Profile: ${formattedProfile.displayName} (${formattedProfile.userId})`, "start");
                log(`Country: ${formattedProfile.country}`, "info");
                log(`Email: ${formattedProfile.email}`, "info");
                log(`Followers: ${formattedProfile.followers}`, "info");
                log(`Spotify URL: ${formattedProfile.externalUrl}`, "info");

                if (formattedProfile.profileImage !== "No image available" && formattedProfile.profileImage.startsWith("http")) {
                    await log(formattedProfile.profileImage, "image");
                }
            }

            return formattedProfile;
        });
    }

    async getFromDb(userId: string): Promise<{ id: number }> {
        const user = await db('users').where({user_id: userId}).select('id').first();
        if (!user) throw new Error(`User with ID ${userId} not found`);
        return user;
    }

    async getId(userId: string): Promise<number> {
        const userRecord = await db('users').where({user_id: userId}).select('id').first();
        if (!userRecord) throw new Error(`User with ID ${userId} not found`);
        return userRecord.id;
    }

    async deleteUser(userId: string): Promise<void> {
        return this.spotify.handler(userId, async () => {
            await this.deleteUserFromDatabase(userId);
        });
    }

    async deleteUserFromDatabase(id: string) {
        await db('users').where('user_id', id).del();
    }

    private async insertUserIntoDatabase(id: string, access_token: string, refresh_token: string, expires_in: number, api_token: string) {
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

    async authorizationCodeGrant(spotifyApi: SpotifyWebApi, code: string, id: string): Promise<SpotifyAuthorizationResponse> {
        try {
            const data = await spotifyApi.authorizationCodeGrant(code);
            const {access_token, refresh_token, expires_in} = data.body;
            const api_token = crypto.createHash('sha256').update(id + access_token).digest('hex');
            await this.insertUserIntoDatabase(id, access_token, refresh_token, expires_in, api_token);
            return {api_token, userId: id};
        } catch (err) {
            console.log(chalk.red('Something went wrong!'), err);
            throw err;
        }
    }

}

export default UserService;