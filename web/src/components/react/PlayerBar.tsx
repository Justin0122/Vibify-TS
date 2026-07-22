import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $playback, $sdkDeviceId, $sdkError, type PlaybackInfo } from '../../stores/player';
import { $isLoggedIn } from '../../stores/auth';
import { api } from '../../lib/api';
import { getPlayer } from '../../lib/sdk';

function formatMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

async function mapApiState(): Promise<void> {
    const state = (await api.playbackState()) as any;
    if (!state?.item) return;
    $playback.set({
        trackName: state.item.name,
        artistName: state.item.artists?.map((artist: any) => artist.name).join(', ') ?? '',
        albumArt: state.item.album?.images?.[0]?.url ?? null,
        uri: state.item.uri,
        paused: !state.is_playing,
        positionMs: state.progress_ms ?? 0,
        durationMs: state.item.duration_ms ?? 0,
        shuffle: state.shuffle_state ?? false,
        repeat: state.repeat_state ?? 'off',
        updatedAt: Date.now(),
        source: 'api',
    });
}

export default function PlayerBar() {
    const playback = useStore($playback);
    const sdkDeviceId = useStore($sdkDeviceId);
    const sdkError = useStore($sdkError);
    const loggedIn = useStore($isLoggedIn);
    const [position, setPosition] = useState(0);
    const playerRef = useRef<Spotify.Player | null>(null);

    useEffect(() => {
        if (!loggedIn) return;
        getPlayer()
            .then(player => (playerRef.current = player))
            .catch(() => {});
        mapApiState().catch(() => {});
    }, [loggedIn]);

    useEffect(() => {
        if (!loggedIn) return;
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            if ($playback.get()?.source === 'sdk') return;
            mapApiState().catch(() => {});
        };
        const interval = setInterval(refresh, 4_000);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [loggedIn]);

    useEffect(() => {
        const interval = setInterval(() => {
            const current = $playback.get();
            if (!current) return;
            setPosition(current.paused ? current.positionMs : Math.min(current.positionMs + (Date.now() - current.updatedAt), current.durationMs));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    if (!loggedIn) return null;

    const usingSdk = playback?.source === 'sdk';

    // double re-sync: Spotify's state API lags right after a command
    const act = async (action: () => Promise<unknown>, optimistic?: Partial<PlaybackInfo>) => {
        try {
            const current = $playback.get();
            if (optimistic && current) $playback.set({ ...current, ...optimistic, updatedAt: Date.now() });
            await action();
            if (!usingSdk) {
                setTimeout(() => mapApiState().catch(() => {}), 400);
                setTimeout(() => mapApiState().catch(() => {}), 1_500);
            }
        } catch (err) {
            console.error('[player]', err);
            if (!usingSdk) mapApiState().catch(() => {});
        }
    };

    const togglePlay = () =>
        act(
            async () => {
                if (usingSdk && playerRef.current) return playerRef.current.togglePlay();
                return playback?.paused ? api.play() : api.pause();
            },
            playback ? { paused: !playback.paused } : undefined,
        );

    const seekTo = (ms: number) =>
        act(
            async () => {
                if (usingSdk && playerRef.current) return playerRef.current.seek(ms);
                return api.seek(Math.floor(ms));
            },
            { positionMs: Math.floor(ms) },
        );

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-surface-raised/95 backdrop-blur">
            {sdkError && <p className="border-b border-yellow-800 bg-yellow-950/60 px-4 py-1 text-xs text-yellow-200">{sdkError}</p>}
            <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
                {playback?.albumArt ? (
                    <img src={playback.albumArt} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                    <div className="h-12 w-12 rounded bg-surface-hover" />
                )}
                <div className="w-40 min-w-0 sm:w-56">
                    <p className="truncate text-sm font-medium">{playback?.trackName ?? 'Nothing playing'}</p>
                    <p className="truncate text-xs text-muted">{playback?.artistName ?? (sdkDeviceId ? 'Vibify Web ready' : '')}</p>
                </div>

                <div className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex items-center gap-3">
                        <button onClick={() => act(() => api.shuffle(!playback?.shuffle), { shuffle: !playback?.shuffle })} title="Shuffle" className={`text-sm ${playback?.shuffle ? 'text-brand' : 'text-muted'}`}>
                            ⇄
                        </button>
                        <button onClick={() => act(() => (usingSdk && playerRef.current ? playerRef.current.previousTrack() : api.previous()))} className="text-lg text-muted hover:text-white">
                            ⏮
                        </button>
                        <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:scale-105">
                            {playback && !playback.paused ? '⏸' : '▶'}
                        </button>
                        <button onClick={() => act(() => (usingSdk && playerRef.current ? playerRef.current.nextTrack() : api.next()))} className="text-lg text-muted hover:text-white">
                            ⏭
                        </button>
                        <button
                            onClick={() => {
                                const nextMode = playback?.repeat === 'off' ? 'context' : playback?.repeat === 'context' ? 'track' : 'off';
                                act(() => api.repeat(nextMode), { repeat: nextMode });
                            }}
                            title={`Repeat: ${playback?.repeat ?? 'off'}`}
                            className={`text-sm ${playback?.repeat !== 'off' && playback ? 'text-brand' : 'text-muted'}`}
                        >
                            {playback?.repeat === 'track' ? '🔂' : '🔁'}
                        </button>
                    </div>
                    {playback && (
                        <div className="flex w-full max-w-md items-center gap-2 text-[10px] text-muted">
                            <span>{formatMs(position)}</span>
                            <input
                                type="range"
                                min={0}
                                max={playback.durationMs}
                                value={position}
                                onChange={event => seekTo(Number(event.target.value))}
                                className="h-1 flex-1 accent-brand"
                            />
                            <span>{formatMs(playback.durationMs)}</span>
                        </div>
                    )}
                </div>

                <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={50}
                    title="Volume"
                    onChange={event => act(() => api.volume(Number(event.target.value)))}
                    className="hidden w-24 accent-brand sm:block"
                />
            </div>
        </div>
    );
}
