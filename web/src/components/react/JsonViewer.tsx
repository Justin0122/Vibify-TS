import { useState } from 'react';

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
    const [open, setOpen] = useState(depth < 2);

    if (value !== null && typeof value === 'object') {
        const isArray = Array.isArray(value);
        const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value as object);
        return (
            <div style={{ marginLeft: depth ? 14 : 0 }}>
                <button onClick={() => setOpen(!open)} className="font-mono text-xs text-muted hover:text-white">
                    {open ? '▾' : '▸'} {name !== undefined && <span className="text-sky-300">{name}: </span>}
                    <span>{isArray ? `[${entries.length}]` : `{${entries.length}}`}</span>
                </button>
                {open && entries.map(([key, val]) => <Node key={key} name={key} value={val} depth={depth + 1} />)}
            </div>
        );
    }

    const color = typeof value === 'string' ? 'text-emerald-300' : typeof value === 'number' ? 'text-amber-300' : 'text-purple-300';
    return (
        <div style={{ marginLeft: 14 }} className="font-mono text-xs">
            {name !== undefined && <span className="text-sky-300">{name}: </span>}
            <span className={color}>{JSON.stringify(value)}</span>
        </div>
    );
}

export default function JsonViewer({ data }: { data: unknown }) {
    if (data === undefined) return <p className="text-xs text-muted">(no body — 204)</p>;
    return (
        <div className="max-h-[32rem] overflow-auto rounded-lg bg-black/40 p-3">
            <Node value={data} depth={0} />
        </div>
    );
}
