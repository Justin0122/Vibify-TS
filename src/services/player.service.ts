import { getClient } from '@/spotify/client';
import { Devices, PlaybackState, Queue } from '@spotify/web-api-ts-sdk';

export async function getPlaybackState(userId: string): Promise<PlaybackState | null> {
    const client = await getClient(userId);
    return (await client.player.getPlaybackState()) ?? null;
}

export async function getDevices(userId: string): Promise<Devices> {
    const client = await getClient(userId);
    return client.player.getAvailableDevices();
}

export async function transferPlayback(userId: string, deviceId: string, play?: boolean): Promise<void> {
    const client = await getClient(userId);
    await client.player.transferPlayback([deviceId], play);
}

export interface PlayInput {
    device_id?: string;
    context_uri?: string;
    uris?: string[];
    offset?: object;
    position_ms?: number;
}

export async function play(userId: string, input: PlayInput): Promise<void> {
    const client = await getClient(userId);
    // SDK startResumePlayback sends wrong key `positionMs`
    const params = input.device_id ? `?device_id=${encodeURIComponent(input.device_id)}` : '';
    await client.makeRequest('PUT', `me/player/play${params}`, {
        context_uri: input.context_uri,
        uris: input.uris,
        offset: input.offset,
        position_ms: input.position_ms,
    });
}

export async function pause(userId: string, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.pausePlayback(deviceId as string);
}

export async function next(userId: string, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.skipToNext(deviceId as string);
}

export async function previous(userId: string, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.skipToPrevious(deviceId as string);
}

export async function seek(userId: string, positionMs: number, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.seekToPosition(positionMs, deviceId);
}

export async function setShuffle(userId: string, state: boolean, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.togglePlaybackShuffle(state, deviceId);
}

export async function setRepeat(userId: string, state: 'off' | 'track' | 'context', deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.setRepeatMode(state, deviceId);
}

export async function setVolume(userId: string, volumePercent: number, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.setPlaybackVolume(volumePercent, deviceId);
}

export async function getQueue(userId: string): Promise<Queue> {
    const client = await getClient(userId);
    return client.player.getUsersQueue();
}

export async function addToQueue(userId: string, uri: string, deviceId?: string): Promise<void> {
    const client = await getClient(userId);
    await client.player.addItemToPlaybackQueue(uri, deviceId);
}
