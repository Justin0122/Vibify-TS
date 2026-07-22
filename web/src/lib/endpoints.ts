export interface EndpointParam {
    name: string;
    in: 'query' | 'body' | 'path';
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    options?: string[];
    placeholder?: string;
}

export interface EndpointDef {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    group: string;
    description: string;
    params?: EndpointParam[];
}

const limitOffset: EndpointParam[] = [
    { name: 'limit', in: 'query', type: 'number', placeholder: '20 (max 50)' },
    { name: 'offset', in: 'query', type: 'number', placeholder: '0' },
];

const timeRange: EndpointParam = { name: 'time_range', in: 'query', type: 'string', options: ['short_term', 'medium_term', 'long_term'] };

export const endpoints: EndpointDef[] = [
    { method: 'GET', path: '/me', group: 'Profile', description: 'Spotify profile of the authenticated user' },
    { method: 'DELETE', path: '/me', group: 'Profile', description: 'Delete user + tokens from Vibify' },
    { method: 'GET', path: '/me/top/tracks', group: 'Library', description: 'Top tracks', params: [...limitOffset, timeRange] },
    { method: 'GET', path: '/me/top/artists', group: 'Library', description: 'Top artists', params: [...limitOffset, timeRange] },
    { method: 'GET', path: '/me/tracks', group: 'Library', description: 'Liked (saved) tracks', params: limitOffset },
    { method: 'GET', path: '/me/tracks/recent', group: 'Library', description: 'Recently played', params: [...limitOffset, { name: 'after', in: 'query', type: 'number' }, { name: 'before', in: 'query', type: 'number' }] },
    { method: 'GET', path: '/me/tracks/contains', group: 'Library', description: 'Check if tracks are liked', params: [{ name: 'ids', in: 'query', type: 'string', required: true, placeholder: 'comma-separated track ids' }] },
    { method: 'PUT', path: '/me/tracks/:trackId', group: 'Library', description: 'Like (save) a track', params: [{ name: 'trackId', in: 'path', type: 'string', required: true }] },
    { method: 'DELETE', path: '/me/tracks/:trackId', group: 'Library', description: 'Unlike a track', params: [{ name: 'trackId', in: 'path', type: 'string', required: true }] },
    { method: 'GET', path: '/me/tracks/years', group: 'Library', description: 'Years with liked tracks (from DB, sync first)' },
    { method: 'GET', path: '/me/tracks/years/:year/months', group: 'Library', description: 'Months with liked tracks in a year', params: [{ name: 'year', in: 'path', type: 'number', required: true }] },
    { method: 'POST', path: '/me/tracks/sync', group: 'Library', description: 'Start background sync of liked tracks into MySQL' },
    { method: 'GET', path: '/me/tracks/sync/status', group: 'Library', description: 'Progress of the running sync job' },
    { method: 'GET', path: '/me/playlists', group: 'Playlists', description: 'Your playlists', params: limitOffset },
    { method: 'GET', path: '/playlists/:playlistId', group: 'Playlists', description: 'Single playlist detail', params: [{ name: 'playlistId', in: 'path', type: 'string', required: true }] },
    { method: 'POST', path: '/me/playlists', group: 'Playlists', description: 'Create playlist (name, or month+year for monthly)', params: [
        { name: 'name', in: 'body', type: 'string' },
        { name: 'description', in: 'body', type: 'string' },
        { name: 'public', in: 'body', type: 'boolean' },
        { name: 'month', in: 'body', type: 'number', placeholder: '1-12' },
        { name: 'year', in: 'body', type: 'number' },
    ] },
    { method: 'POST', path: '/me/playlists/monthly', group: 'Playlists', description: 'Create playlists for every liked month' },
    { method: 'GET', path: '/search', group: 'Catalog', description: 'Search Spotify (limit max 10 — Spotify dev-mode cap)', params: [
        { name: 'q', in: 'query', type: 'string', required: true },
        { name: 'type', in: 'query', type: 'string', options: ['track', 'artist', 'album', 'playlist'] },
        { name: 'limit', in: 'query', type: 'number', placeholder: '10 max' },
        { name: 'offset', in: 'query', type: 'number', placeholder: '0' },
    ] },
    { method: 'GET', path: '/artists/:artistId', group: 'Catalog', description: 'Artist details', params: [{ name: 'artistId', in: 'path', type: 'string', required: true }] },
    { method: 'GET', path: '/artists/:artistId/albums', group: 'Catalog', description: 'Artist albums', params: [{ name: 'artistId', in: 'path', type: 'string', required: true }, ...limitOffset] },
    { method: 'GET', path: '/me/player', group: 'Player', description: 'Full playback state' },
    { method: 'PUT', path: '/me/player', group: 'Player', description: 'Transfer playback to a device', params: [{ name: 'device_id', in: 'body', type: 'string', required: true }, { name: 'play', in: 'body', type: 'boolean' }] },
    { method: 'GET', path: '/me/player/devices', group: 'Player', description: 'Available devices' },
    { method: 'GET', path: '/me/player/currently-playing', group: 'Player', description: 'Currently playing item' },
    { method: 'PUT', path: '/me/player/play', group: 'Player', description: 'Start/resume playback', params: [
        { name: 'context_uri', in: 'body', type: 'string', placeholder: 'spotify:album:… / spotify:playlist:…' },
        { name: 'uris', in: 'body', type: 'string', placeholder: 'comma-separated spotify:track:… uris' },
        { name: 'position_ms', in: 'body', type: 'number' },
        { name: 'device_id', in: 'body', type: 'string' },
    ] },
    { method: 'PUT', path: '/me/player/pause', group: 'Player', description: 'Pause playback' },
    { method: 'POST', path: '/me/player/next', group: 'Player', description: 'Skip to next track' },
    { method: 'POST', path: '/me/player/previous', group: 'Player', description: 'Skip to previous track' },
    { method: 'PUT', path: '/me/player/seek', group: 'Player', description: 'Seek', params: [{ name: 'position_ms', in: 'query', type: 'number', required: true }] },
    { method: 'PUT', path: '/me/player/shuffle', group: 'Player', description: 'Toggle shuffle', params: [{ name: 'state', in: 'query', type: 'string', required: true, options: ['true', 'false'] }] },
    { method: 'PUT', path: '/me/player/repeat', group: 'Player', description: 'Repeat mode', params: [{ name: 'state', in: 'query', type: 'string', required: true, options: ['off', 'track', 'context'] }] },
    { method: 'PUT', path: '/me/player/volume', group: 'Player', description: 'Set volume', params: [{ name: 'volume_percent', in: 'query', type: 'number', required: true, placeholder: '0-100' }] },
    { method: 'GET', path: '/me/player/queue', group: 'Player', description: 'Current queue' },
    { method: 'POST', path: '/me/player/queue', group: 'Player', description: 'Add item to queue', params: [{ name: 'uri', in: 'query', type: 'string', required: true, placeholder: 'spotify:track:…' }] },
    { method: 'GET', path: '/auth/token', group: 'Auth', description: 'Fresh Spotify access token (used by Web Playback SDK)' },
];
