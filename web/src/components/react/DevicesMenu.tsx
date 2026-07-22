import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sdkDeviceId } from '../../stores/player';
import { api, type Device } from '../../lib/api';

export default function DevicesMenu() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [error, setError] = useState('');
    const sdkDeviceId = useStore($sdkDeviceId);

    const load = () =>
        api
            .devices()
            .then(res => setDevices(res.devices))
            .catch(err => setError(err.message));

    useEffect(() => {
        load();
        const interval = setInterval(load, 15_000);
        return () => clearInterval(interval);
    }, []);

    const transfer = async (deviceId: string) => {
        try {
            await api.transferPlayback(deviceId);
            setTimeout(load, 500);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="rounded-2xl bg-surface-raised p-5">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Devices</h2>
                <button onClick={load} className="rounded-full bg-white/10 px-3 py-1 text-xs">Refresh</button>
            </div>
            {error && <p className="mb-2 text-sm text-red-300">{error}</p>}
            {devices.length === 0 && <p className="text-sm text-muted">No devices found. Open Spotify somewhere (or the in-browser player).</p>}
            <ul className="space-y-2">
                {devices.map(device => (
                    <li key={device.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
                        <span className="text-lg">{device.type === 'Computer' ? '💻' : device.type === 'Smartphone' ? '📱' : '🔊'}</span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {device.name}
                                {device.id === sdkDeviceId && <span className="ml-2 text-xs text-brand">(this browser)</span>}
                            </p>
                            <p className="text-xs text-muted">{device.type} · vol {device.volume_percent}%</p>
                        </div>
                        {device.is_active ? (
                            <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">active</span>
                        ) : (
                            <button onClick={() => transfer(device.id)} className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-surface-hover">
                                Transfer
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
