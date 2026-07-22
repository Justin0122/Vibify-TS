import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface QueueTrack {
    id: string;
    uri: string;
    name: string;
    artists?: { name: string }[];
    album?: { images?: { url: string }[] };
}

export default function QueuePanel() {
    const [current, setCurrent] = useState<QueueTrack | null>(null);
    const [queue, setQueue] = useState<QueueTrack[]>([]);
    const [uriInput, setUriInput] = useState('');
    const [error, setError] = useState('');

    const load = () =>
        api
            .queue()
            .then((res: any) => {
                setCurrent(res.currently_playing ?? null);
                setQueue(res.queue ?? []);
                setError('');
            })
            .catch(err => setError(err.message));

    useEffect(() => {
        load();
        const interval = setInterval(load, 15_000);
        return () => clearInterval(interval);
    }, []);

    const add = async () => {
        if (!uriInput.trim()) return;
        try {
            await api.addToQueue(uriInput.trim());
            setUriInput('');
            setTimeout(load, 500);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const row = (track: QueueTrack, label?: string) => (
        <li key={`${track.id}-${label ?? ''}`} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
            {track.album?.images?.length ? <img src={track.album.images[track.album.images.length - 1].url} alt="" className="h-8 w-8 rounded" /> : null}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{track.name}</p>
                <p className="truncate text-xs text-muted">{track.artists?.map(artist => artist.name).join(', ')}</p>
            </div>
            {label && <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">{label}</span>}
        </li>
    );

    return (
        <div className="rounded-2xl bg-surface-raised p-5">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Queue</h2>
                <button onClick={load} className="rounded-full bg-white/10 px-3 py-1 text-xs">Refresh</button>
            </div>
            {error && <p className="mb-2 text-sm text-red-300">{error}</p>}
            <div className="mb-3 flex gap-2">
                <input
                    value={uriInput}
                    onChange={event => setUriInput(event.target.value)}
                    placeholder="spotify:track:… or search & use ＋"
                    className="flex-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
                />
                <button onClick={add} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black">Add</button>
            </div>
            <ul className="max-h-96 space-y-2 overflow-y-auto">
                {current && row(current, 'now')}
                {queue.map(track => row(track))}
                {!current && queue.length === 0 && <p className="text-sm text-muted">Queue empty / nothing playing.</p>}
            </ul>
        </div>
    );
}
