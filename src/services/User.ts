import Spotify from "@/services/Spotify";
import { deleteUserFromDatabase } from "@/services/Database";

export async function getSpotifyUser(this: Spotify, userId: string): Promise<SpotifyApi.CurrentUsersProfileResponse> {
    return this.handler(userId, async () => {
        const spotifyProfile = await this.spotifyApi.getMe();
        return spotifyProfile.body;
    });
}

export async function deleteUser(this: Spotify, userId: string): Promise<void> {
    return this.handler(userId, async () => {
        await deleteUserFromDatabase(userId);
    });
}