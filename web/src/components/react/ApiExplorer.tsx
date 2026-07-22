import { useMemo, useState } from 'react';
import { endpoints, type EndpointDef } from '../../lib/endpoints';
import { request } from '../../lib/api';
import JsonViewer from './JsonViewer';

const methodColors: Record<string, string> = {
    GET: 'bg-sky-600',
    POST: 'bg-emerald-600',
    PUT: 'bg-amber-600',
    DELETE: 'bg-red-600',
};

export default function ApiExplorer() {
    const [selected, setSelected] = useState<EndpointDef>(endpoints[0]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [result, setResult] = useState<unknown>();
    const [status, setStatus] = useState<{ code?: number; ms?: number; error?: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const groups = useMemo(() => {
        const map = new Map<string, EndpointDef[]>();
        for (const endpoint of endpoints) {
            map.set(endpoint.group, [...(map.get(endpoint.group) ?? []), endpoint]);
        }
        return [...map.entries()];
    }, []);

    const pick = (endpoint: EndpointDef) => {
        setSelected(endpoint);
        setValues({});
        setResult(undefined);
        setStatus(null);
    };

    const fire = async () => {
        setBusy(true);
        setStatus(null);
        const start = performance.now();
        try {
            let path = selected.path;
            const query: Record<string, unknown> = {};
            let body: Record<string, unknown> | undefined;

            for (const param of selected.params ?? []) {
                const raw = values[param.name]?.trim();
                if (!raw) {
                    if (param.required) throw new Error(`${param.name} is required`);
                    continue;
                }
                const value: unknown =
                    param.type === 'number' ? Number(raw)
                    : param.type === 'boolean' ? raw === 'true'
                    : param.name === 'uris' ? raw.split(',').map(uri => uri.trim())
                    : raw;
                if (param.in === 'path') path = path.replace(`:${param.name}`, encodeURIComponent(raw));
                else if (param.in === 'query') query[param.name] = value;
                else (body ??= {})[param.name] = value;
            }

            const data = await request(selected.method, path, { query, body });
            setResult(data);
            setStatus({ code: data === undefined ? 204 : 200, ms: Math.round(performance.now() - start) });
        } catch (err: any) {
            setResult(undefined);
            setStatus({ code: err.status, ms: Math.round(performance.now() - start), error: err.message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <aside className="max-h-[70vh] overflow-y-auto rounded-2xl bg-surface-raised p-3">
                {groups.map(([group, defs]) => (
                    <div key={group} className="mb-3">
                        <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{group}</p>
                        {defs.map(endpoint => (
                            <button
                                key={`${endpoint.method} ${endpoint.path}`}
                                onClick={() => pick(endpoint)}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${selected === endpoint ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}
                            >
                                <span className={`w-12 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${methodColors[endpoint.method]}`}>
                                    {endpoint.method}
                                </span>
                                <span className="truncate font-mono">{endpoint.path}</span>
                            </button>
                        ))}
                    </div>
                ))}
            </aside>

            <section className="rounded-2xl bg-surface-raised p-5">
                <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${methodColors[selected.method]}`}>{selected.method}</span>
                    <code className="text-sm">{selected.path}</code>
                </div>
                <p className="mb-4 text-sm text-muted">{selected.description}</p>

                {(selected.params ?? []).map(param => (
                    <div key={param.name} className="mb-2 flex items-center gap-2">
                        <label className="w-32 shrink-0 text-xs text-muted">
                            {param.name}
                            {param.required && <span className="text-red-400"> *</span>}
                            <span className="block text-[10px] opacity-60">{param.in}</span>
                        </label>
                        {param.options ? (
                            <select
                                value={values[param.name] ?? ''}
                                onChange={event => setValues({ ...values, [param.name]: event.target.value })}
                                className="flex-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm"
                            >
                                <option value="">(default)</option>
                                {param.options.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                value={values[param.name] ?? ''}
                                onChange={event => setValues({ ...values, [param.name]: event.target.value })}
                                placeholder={param.placeholder ?? param.type}
                                className="flex-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 font-mono text-sm outline-none focus:border-brand"
                            />
                        )}
                    </div>
                ))}

                <div className="mt-4 mb-4 flex items-center gap-3">
                    <button onClick={fire} disabled={busy} className="rounded-lg bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40">
                        {busy ? 'Firing…' : 'Send request'}
                    </button>
                    {status && (
                        <span className={`text-sm ${status.error ? 'text-red-300' : 'text-brand'}`}>
                            {status.code ?? '–'} · {status.ms}ms{status.error ? ` · ${status.error}` : ''}
                        </span>
                    )}
                </div>

                <JsonViewer data={result} />
            </section>
        </div>
    );
}
