export interface SpotifyAuthorizationResponse {
    api_token: string;
    userId: string;
}

export interface RecommendationsOptions {
    seedArtists: string[];
    seedGenres: string[];
    seedTracks: string[];
    limit?: number;
    market?: string;
    likedTracks?: {
        use?: boolean;
        amount?: number;
    }
    recentTracks?: {
        use?: boolean;
        amount?: number;
    }
    topTracks?: {
        use?: boolean;
        amount?: number;
    }
    topArtists?: {
        use?: boolean;
        amount?: number;
    }
    currentlyPlaying?: boolean;
}


export interface PaginationOptions {
    limit?: number;
    offset?: number;
    after?: number;
    before?: number;
}