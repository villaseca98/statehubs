import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileText, LayoutGrid, Search } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { globalSearch } from '@/lib/crm/filters';
import {computeToday} from '@/lib/crm/today';
import {prioritizeWork} from '@/lib/crm/operationalIntelligence';
import {matchOpportunities} from '@/lib/crm/matchIntelligence';
import type { SearchHit } from '@/lib/crm/filters';

// Cmd/Ctrl+K: find any record of any section (by name, phone, email or
// reference) or jump to a section. Enter opens it.

interface Props {
  blueprint: Blueprint;
  records: AppRecord[];
  sections: { key: string; label: string }[];
  onClose: () => void;
  onRecord: (id: string) => void;
  onSection: (key: string) => void;
}

export function CommandPalette({ blueprint, records, sections, onClose, onRecord, onSection }: Props) {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const hits = useMemo(() => {
    const q=query.trim().toLowerCase();
    const standard=globalSearch(blueprint,records,sections,q);
    if(!q)return sections.map(s=>({kind:'section' as const,id:s.key,title:s.label,subtitle:'Section',score:0}));
    if(/^(overdue|follow.?ups?|what.*(today|next)|priorit)/.test(q)){
      const t=computeToday(blueprint,records);
      const queue=prioritizeWork([...t.atrasado,...t.hoy,...t.proximo]);
      return queue.slice(0,8).map(a=>({kind:'record' as const,id:a.record.id,title:a.title,subtitle:a.reason+' · '+a.explanation,score:a.score}));
    }
    if(/^(match|buyers? for|properties for|compatible)/.test(q)){
      const results=matchOpportunities(records,/rent|tenant|lease/.test(q)?'rent':'sale');
      return results.slice(0,8).map(m=>({kind:'record' as const,id:m.property.id,title:String(m.property.data.direccion||m.property.data.nombre||'Property'),subtitle:`${m.score}% criteria fit · ${m.reasons.join(', ')}`,score:m.score}));
    }
    return standard;
  },[blueprint,records,sections,query]);

  useEffect(() => { setAt(0); }, [query]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [at]);

  const pick = (h: SearchHit | undefined) => {
    if (!h) return;
    if (h.kind === 'record') onRecord(h.id); else onSection(h.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[10vh]" style={{ background: 'rgba(0,0,0,.4)' }} onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Workspace command bar" onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden"
        style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)', boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <label className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--crm-border)' }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--crm-muted)' }} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} role="combobox" aria-expanded="true" aria-controls="crm-palette-list"
            aria-label="Search or ask for actions" placeholder="Search, overdue follow-ups, match buyers, properties for rent…" className="w-full bg-transparent text-[1.05em] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(hits.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); pick(hits[at]); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }} />
          <kbd className="hidden rounded px-1.5 text-[0.8em] sm:inline" style={{ border: '1px solid var(--crm-border)', color: 'var(--crm-muted)' }}>Esc</kbd>
        </label>
        <ul id="crm-palette-list" ref={list} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {hits.map((h, i) => {
            const Icon = h.kind === 'record' ? FileText : LayoutGrid;
            return (
              <li key={`${h.kind}.${h.id}`} role="option" aria-selected={i === at} onMouseEnter={() => setAt(i)} onClick={() => pick(h)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2"
                style={i === at ? { background: 'color-mix(in srgb, var(--crm-primary) 12%, transparent)' } : undefined}>
                <Icon className="h-4 w-4 shrink-0" style={{ color: i === at ? 'var(--crm-primary)' : 'var(--crm-muted)' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.title}</span>
                  <span className="block truncate text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>{h.subtitle}</span>
                </span>
                {i === at && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--crm-muted)' }} />}
              </li>
            );
          })}
          {hits.length === 0 && <li className="px-3 py-6 text-center" style={{ color: 'var(--crm-muted)' }}>No results for “{query}”.</li>}
        </ul>
      </div>
    </div>
  );
}
