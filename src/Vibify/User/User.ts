import UserService from "@/Vibify/User/user.service";
import Spotify from "@/Vibify/Spotify";
import {log, SpotifyAuthorizationResponse} from "@/types/spotify";
import {FormattedProfile} from "@/Vibify/User/user.types";
import SpotifyWebApi from "spotify-web-api-node";

class User {
    private userService: UserService;

    constructor(spotify: Spotify) {
        this.userService = new UserService(spotify);
    }

    async getSpotifyUser(userId: string, log: log): Promise<FormattedProfile> {
        return this.userService.getSpotifyUser(userId, log);
    }

    async getFromDb(userId: string): Promise<{ id: number }> {
        return this.userService.getFromDb(userId);
    }

    async getId(userId: string): Promise<number> {
        return this.userService.getId(userId);
    }

    async deleteUser(userId: string): Promise<void> {
        return this.userService.deleteUser(userId);
    }

    async authorizationCodeGrant(spotifyApi: SpotifyWebApi, code: string, id: string): Promise<SpotifyAuthorizationResponse> {
        return this.userService.authorizationCodeGrant(spotifyApi, code, id);
    }
}

export default User;