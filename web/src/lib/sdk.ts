import { getAccessToken } from '../stores/token';
import { $playback, $sdkDeviceId, $sdkError } from '../stores/player';

let playerPromise: Promise<Spotify.Player> | null = null;

function mapState(state: Spotify.PlaybackState): void {
    const track = state.track_window.current_track;
    $playback.set({
        trackName: track?.name ?? '',
        artistName: track?.artists.map(artist => artist.name).join(', ') ?? '',
        albumArt: track?.album.images[0]?.url ?? null,
        uri: track?.uri ?? '',
        paused: state.paused,
        positionMs: state.position,
        durationMs: state.duration,
        shuffle: state.shuffle,
        repeat: (['off', 'context', 'track'] as const)[state.repeat_mode],
        updatedAt: Date.now(),
        source: 'sdk',
    });
}

function injectScriptOnce(): void {
    if (document.querySelector('script[data-spotify-sdk]')) return;
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.dataset.spotifySdk = 'true';
    document.head.appendChild(script);
}

export function getPlayer(): Promise<Spotify.Player> {
    if (playerPromise) return playerPromise;
    playerPromise = new Promise((resolve, reject) => {
        if (!window.isSecureContext && location.hostname !== 'localhost') {
            $sdkError.set('In-browser player needs HTTPS or localhost (DRM secure context). Use device transfer instead.');
            reject(new Error('insecure context'));
            return;
        }
        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new Spotify.Player({
                name: 'Vibify Web',
                getOAuthToken: callback => {
                    getAccessToken().then(callback).catch(() => $sdkError.set('Could not fetch playback token'));
                },
                volume: 0.5,
            });
            player.addListener('ready', ({ device_id }) => {
                $sdkDeviceId.set(device_id);
                $sdkError.set(null);
            });
            player.addListener('not_ready', () => $sdkDeviceId.set(null));
            player.addListener('player_state_changed', state => {
                if (state) mapState(state);
            });
            player.addListener('initialization_error', ({ message }) => $sdkError.set(`SDK init failed: ${message} (browser may lack Widevine DRM)`));
            player.addListener('authentication_error', () => {
                getAccessToken(true).catch(() => {});
            });
            player.addListener('account_error', ({ message }) => $sdkError.set(`Account error: ${message} (Premium required)`));
            player
                .connect()
                .then(connected => (connected ? resolve(player) : reject(new Error('SDK connect failed'))));
        };
        injectScriptOnce();
    });
    return playerPromise;
}
