import { useMemo, useState } from 'react';
import { ArrowUpRight, Building2, GitBranch, Search } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';

export function LivingWorkspace({ blueprint, records, onOpen }: { blueprint: Blueprint; records: AppRecord[]; onOpen: (record: AppRecord) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(records.map(r => [r.id, r])), [records]);
  const title = (r: AppRecord) => {
    const entity = blueprint.entities.find(e => e.key === r.entity);
    return String(r.data[entity?.titleField ?? 'name'] ?? entity?.label ?? 'Untitled');
  };
  const properties = records.filter(r => /inmueble|property|propiedad|alojamiento|unidad/i.test(r.entity));
  const roots = properties.length ? properties : records;
  const visible = roots.filter(r => title(r).toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  const current = byId.get(selected ?? '') ?? visible[0] ?? null;
  const connected = useMemo(() => {
    if (!current) return [];
    const links: { record: AppRecord; label: string }[] = [];
    for (const r of records) {
      const entity = blueprint.entities.find(e => e.key === r.entity);
      for (const f of entity?.fields ?? []) {
        if (f.type !== 'relation') continue;
        const value = r.data[f.key];
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (typeof id !== 'string') continue;
          if (r.id === current.id && byId.has(id)) links.push({ record: byId.get(id)!, label: f.label });
          else if (id === current.id) links.push({ record: r, label: f.label });
        }
      }
    }
    return links;
  }, [records, blueprint.entities, current, byId]);
  return <section aria-label="Living workspace" className="mb-6 rounded-[30px] border p-5 md:p-7" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--crm-primary)' }}><GitBranch className="h-4 w-4" /> Living workspace</p>
    <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Everything is connected.</h2>
    <p className="mt-2 mb-6 text-sm" style={{ color: 'var(--crm-muted)' }}>Explore relationships between properties, clients and deals using your actual records.</p>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0 rounded-2xl border p-4" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
        {current && <div className="mb-5 overflow-hidden rounded-2xl border bg-white p-3" style={{borderColor:'var(--crm-border)'}}>
          <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-primary)'}}>Deal constellation</span><span className="text-xs" style={{color:'var(--crm-muted)'}}>{connected.length} live links</span></div>
          <svg viewBox="0 0 600 230" role="img" aria-label={`Relationship graph for ${title(current)} with ${connected.length} connections`} className="h-auto w-full">
            <defs><linearGradient id="constellationGradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E87B70"/><stop offset="1" stopColor="#B94C48"/></linearGradient></defs>
            {connected.slice(0,6).map((item,i)=>{const angle=(i/Math.max(connected.slice(0,6).length,1))*Math.PI*2-Math.PI/2;const x=300+Math.cos(angle)*205;const y=115+Math.sin(angle)*76;return <g key={item.record.id+i}><path d={`M 300 115 Q ${(300+x)/2} ${(115+y)/2-14} ${x} ${y}`} fill="none" stroke="#D98B80" strokeWidth="1.5" strokeDasharray="4 4"/><circle cx={x} cy={y} r="22" fill="#FCEBE6" stroke="#E8ADA4" strokeWidth="1.5"/><circle cx={x} cy={y} r="5" fill="#C25B53"/><text x={x} y={y+34} textAnchor="middle" fontSize="11" fill="#865E58">{title(item.record).slice(0,18)}</text></g>})}
            <circle cx="300" cy="115" r="38" fill="url(#constellationGradient)"/><circle cx="300" cy="115" r="44" fill="none" stroke="#E8ADA4" strokeWidth="1.5"/><text x="300" y="112" textAnchor="middle" fontSize="12" fontWeight="600" fill="white">PROPERTY</text><text x="300" y="126" textAnchor="middle" fontSize="9" fill="white">360°</text>
          </svg>
          <p className="text-center text-xs" style={{color:'var(--crm-muted)'}}>Select a record below to explore its network.</p>
        </div>}
        <label className="mb-4 flex items-center gap-2 rounded-xl border bg-white px-3 py-2"><Search className="h-4 w-4" /><span className="sr-only">Search records</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a property…" className="w-full bg-transparent text-sm outline-none" /></label>
        {visible.length ? <div className="grid gap-2 sm:grid-cols-2">{visible.map(r => <button key={r.id} onClick={() => setSelected(r.id)} aria-pressed={current?.id === r.id} className="sh-press flex items-center gap-3 rounded-xl border bg-white p-3 text-left hover:shadow-md" style={{ borderColor: current?.id === r.id ? 'var(--crm-primary)' : 'var(--crm-border)' }}><Building2 className="h-5 w-5 shrink-0" style={{ color: 'var(--crm-primary)' }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{title(r)}</span></button>)}</div> : <p className="py-8 text-center text-sm">No matching records.</p>}
      </div>
      <div className="min-w-0 rounded-2xl border p-5" style={{ borderColor: 'var(--crm-border)' }}>
        {current ? <><p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--crm-primary)' }}>Property 360°</p><h3 className="mt-2 text-xl font-semibold">{title(current)}</h3><button onClick={() => onOpen(current)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--crm-primary)' }}>Open full record <ArrowUpRight className="h-4 w-4" /></button><div className="my-5 border-t" /><h4 className="mb-3 font-semibold">Connected records ({connected.length})</h4>{connected.length ? connected.slice(0, 10).map(({ record, label }, i) => <button key={record.id + i} onClick={() => onOpen(record)} className="mb-2 flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-black/5" style={{ background: 'var(--crm-bg)' }}><span className="min-w-0"><span className="block truncate text-sm font-medium">{title(record)}</span><span className="text-xs" style={{ color: 'var(--crm-muted)' }}>{label}</span></span><ArrowUpRight className="h-4 w-4" /></button>) : <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>No relationships yet. Link records through their existing relationship fields.</p>}</> : <p>Select a record to explore its connections.</p>}
      </div>
    </div>
  </section>;
}
