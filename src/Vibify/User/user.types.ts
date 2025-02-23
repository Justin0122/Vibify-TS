import {Readable} from "stream";

export interface FormattedProfile {
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

export interface User {
    id: number;
    user_id: string;
    access_token: string;
    refresh_token: string;
    expires_in: string;
    api_token: string;
    created_at: string;
    updated_at: string;
    expires_at: Date;
}