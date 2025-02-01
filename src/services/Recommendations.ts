import Spotify from "@/services/Spotify";
import {RecommendationsOptions} from "@/types/spotify";
import {getAudioFeaturesForTracks} from "@/services/Tracks";

export async function getRecommendations(this: Spotify, userId: string, options: SpotifyApi.RecommendationsOptionsObject): Promise<SpotifyApi.RecommendationsFromSeedsResponse> {
    return this.handler(userId, async () => {
        const recommendations = await this.spotifyApi.getRecommendations(options);
        return recommendations.body;
    });
}

export function buildApiOptions(options: RecommendationsOptions): SpotifyApi.RecommendationsOptionsObject {
    return {
        seed_artists: options.seedArtists || [],
        seed_genres: options.seedGenres || [],
        seed_tracks: options.seedTracks || [],
        limit: options.limit,
        market: options.market,
    };
}


export async function getAudioFeaturesValues(this: Spotify, userId: string, seeds: {
    type: string,
    value: string
}[]): Promise<Record<string, { min: number, max: number }>> {
    const audioFeatures = await getAudioFeaturesForTracks.call(this, userId, seeds.map(seed => seed.value));
    console.log(audioFeatures);
    return audioFeatures.audio_features.reduce((acc, curr) => {
        Object.keys(curr).forEach(key => {
            const value = curr[key as keyof typeof curr];
            if (typeof value === 'number') {
                if (!acc[key]) {
                    acc[key] = {min: value, max: value};
                } else {
                    acc[key].min = Math.min(acc[key].min, value);
                    acc[key].max = Math.max(acc[key].max, value);
                }
            }
        });
        return acc;
    }, {} as Record<string, { min: number, max: number }>);
}

export async function setTargetValues(this: Spotify, apiOptions: SpotifyApi.RecommendationsOptionsObject, audioFeaturesValues: Record<string, {
    min: number,
    max: number
}>): Promise<void> {
    Object.keys(audioFeaturesValues).forEach(key => {
        const feature = audioFeaturesValues[key];
        (apiOptions as any)[`target_${key}`] = feature.min + (feature.max - feature.min) / 2;
    });
}

export async function gatherSeeds(this: Spotify, userId: string, options: RecommendationsOptions): Promise<{
    type: string,
    value: string
}[]> {
    const seeds: { type: string, value: string }[] = [];

    if (options.likedTracks?.use) {
        const likedTracks = await this.getSavedTracks(userId, {limit: options.likedTracks.amount || 50});
        seeds.push(...likedTracks.items.map(track => ({type: 'track', value: track.track.id})));
    }
    if (options.recentTracks?.use) {
        const recentTracks = await this.getRecentlyPlayedTracks(userId, {limit: options.recentTracks.amount || 50});
        seeds.push(...recentTracks.items.map(track => ({type: 'track', value: track.track.id})));
    }
    if (options.topTracks?.use) {
        const topTracks = await this.getTopTracks(userId, {limit: options.topTracks.amount || 50});
        seeds.push(...topTracks.items.map(track => ({type: 'track', value: track.id})));
    }
    if (options.topArtists?.use) {
        const topArtists = await this.getTopArtists(userId, {limit: options.topArtists.amount || 5});
        seeds.push(...topArtists.items.map(artist => ({type: 'artist', value: artist.id})));
    }
    if (options.currentlyPlaying) {
        const currentPlayback = await this.getCurrentPlayback(userId);
        if (currentPlayback && currentPlayback.item) {
            seeds.push({type: 'track', value: currentPlayback.item.id});
        }
    }

    seeds.push(...options.seedArtists.map(artist => ({type: 'artist', value: artist})));
    seeds.push(...options.seedGenres.map(genre => ({type: 'genre', value: genre})));
    seeds.push(...options.seedTracks.map(track => ({type: 'track', value: track})));

    if (seeds.length === 0) {
        const recentTracks = await this.getRecentlyPlayedTracks(userId, {limit: 5});
        seeds.push(...recentTracks.items.map(track => ({type: 'track', value: track.track.id})));
    }

    if (seeds.length > 5) seeds.sort(() => Math.random() - 0.5);

    return seeds.slice(0, 5);
}