import { $auth, logout } from '../stores/auth';

// env override > dev server (port 5432) targets <host>:3333 > same origin
function deriveBase(): string {
    const configured = (import.meta.env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');
    if (configured) return configured;
    if (typeof location !== 'undefined' && location.port === '5432') {
        return `${location.protocol}//${location.hostname}:3333`;
    }
    return '';
}

const BASE = deriveBase();

export class ApiError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function buildQuery(query?: Record<string, unknown>): string {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export async function request<T = unknown>(
    method: string,
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown; auth?: boolean } = {},
): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.auth !== false) headers['X-API-Key'] = $auth.get().apiToken;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE}${path}${buildQuery(options.query)}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && options.auth !== false) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'UNAUTHORIZED') logout();
        throw new ApiError(401, data.error ?? 'Unauthorized', data.code);
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(res.status, data.error ?? 'Request failed', data.code);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export interface Pagination {
    limit?: number;
    offset?: number;
}

export const api = {
    base: BASE,
    authorizeUrl: (userId: string) => `${BASE}/auth/authorize/${encodeURIComponent(userId)}`,
    exchange: (code: string) => request<{ userId: string; api_token: string }>('POST', '/auth/exchange', { body: { code }, auth: false }),
    playbackToken: () => request<{ access_token: string; expires_at: string }>('GET', '/auth/token'),
    profile: () => request('GET', '/me'),
    deleteAccount: () => request('DELETE', '/me'),
    topTracks: (query: Pagination & { time_range?: string }) => request('GET', '/me/top/tracks', { query }),
    topArtists: (query: Pagination & { time_range?: string }) => request('GET', '/me/top/artists', { query }),
    likedTracks: (query: Pagination) => request('GET', '/me/tracks', { query }),
    recentTracks: (query: Pagination & { after?: number; before?: number }) => request('GET', '/me/tracks/recent', { query }),
    likedYears: () => request<number[]>('GET', '/me/tracks/years'),
    likedMonths: (year: number) => request<number[]>('GET', `/me/tracks/years/${year}/months`),
    likeTrack: (trackId: string) => request('PUT', `/me/tracks/${trackId}`),
    unlikeTrack: (trackId: string) => request('DELETE', `/me/tracks/${trackId}`),
    containsTracks: (ids: string[]) => request<boolean[]>('GET', '/me/tracks/contains', { query: { ids: ids.join(',') } }),
    startSync: () => request<{ started: boolean; message: string }>('POST', '/me/tracks/sync'),
    syncStatus: () => request<{ state: string; processed: number; total: number; message?: string }>('GET', '/me/tracks/sync/status'),
    playlists: (query: Pagination) => request('GET', '/me/playlists', { query }),
    playlist: (id: string) => request('GET', `/playlists/${id}`),
    createPlaylist: (body: { name?: string; description?: string; public?: boolean; month?: number; year?: number }) =>
        request('POST', '/me/playlists', { body }),
    createMonthlyPlaylists: () => request('POST', '/me/playlists/monthly'),
    search: (q: string, type: string, query: Pagination = {}) => request('GET', '/search', { query: { q, type, ...query } }),
    artist: (id: string) => request('GET', `/artists/${id}`),
    artistAlbums: (id: string, query: Pagination = {}) => request('GET', `/artists/${id}/albums`, { query }),
    playbackState: () => request('GET', '/me/player'),
    devices: () => request<{ devices: Device[] }>('GET', '/me/player/devices'),
    transferPlayback: (deviceId: string, play = true) => request('PUT', '/me/player', { body: { device_id: deviceId, play } }),
    play: (body: { device_id?: string; context_uri?: string; uris?: string[]; position_ms?: number } = {}) =>
        request('PUT', '/me/player/play', { body }),
    pause: () => request('PUT', '/me/player/pause'),
    next: () => request('POST', '/me/player/next'),
    previous: () => request('POST', '/me/player/previous'),
    seek: (positionMs: number) => request('PUT', '/me/player/seek', { query: { position_ms: positionMs } }),
    shuffle: (state: boolean) => request('PUT', '/me/player/shuffle', { query: { state } }),
    repeat: (state: 'off' | 'track' | 'context') => request('PUT', '/me/player/repeat', { query: { state } }),
    volume: (percent: number) => request('PUT', '/me/player/volume', { query: { volume_percent: percent } }),
    queue: () => request('GET', '/me/player/queue'),
    addToQueue: (uri: string) => request('POST', '/me/player/queue', { query: { uri } }),
};

export interface Device {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    volume_percent: number;
}
