import { atom } from 'nanostores';

export interface PlaybackInfo {
    trackName: string;
    artistName: string;
    albumArt: string | null;
    uri: string;
    paused: boolean;
    positionMs: number;
    durationMs: number;
    shuffle: boolean;
    repeat: 'off' | 'track' | 'context';
    updatedAt: number;
    source: 'sdk' | 'api';
}

export const $playback = atom<PlaybackInfo | null>(null);
export const $sdkDeviceId = atom<string | null>(null);
export const $sdkError = atom<string | null>(null);
