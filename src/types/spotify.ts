export interface SpotifyAuthorizationResponse {
    api_token: string;
    userId: string;
}

export interface PaginationOptions {
    limit?: number;
    offset?: number;
    after?: number;
    before?: number;
}

export interface log {
    (message: string, type: string): void;
}