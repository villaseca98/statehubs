import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CircleCheck, Clock3, Target, Users, ArrowUpRight } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { dashboardMetrics } from '@/lib/crm/dashboard';
import type { WindowDays } from '@/lib/crm/dashboard';

const icon = [Users, CalendarDays, Target, Clock3];
const panel = 'rounded-[22px] border p-4 sm:p-5';
const surface = { background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' } as const;
export function OperationsDashboard({ blueprint, records, now, onOpen }: { blueprint: Blueprint; records: AppRecord[]; now?: Date; onOpen: (record: AppRecord) => void }) {
  const [days, setDays] = useState<WindowDays>(30);
  const data = useMemo(() => dashboardMetrics(blueprint, records, days, now), [blueprint, records, days, now]);
  const max = Math.max(1, ...data.series.map((p) => p.leads));
  const plotted = data.series.filter((_, i) => days <= 30 || i % 3 === 0 || i === days - 1);
  const sum = data.series.reduce((n, p) => n + p.leads, 0);
  return <section aria-label="Indicadores de operaciones" className="mb-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: 'var(--crm-muted)' }}>Agency overview</p>
        <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Your business, in motion.</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Live workspace data · sample records excluded</p></div>
      <div role="group" aria-label="Dashboard period" className="inline-flex rounded-full border p-1" style={surface}>
        {([7, 30, 90] as const).map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}
          className="sh-focus rounded-full px-3 py-2 text-xs font-semibold transition-colors motion-reduce:transition-none"
          style={days === n ? { background: 'var(--crm-primary)', color: '#fff' } : { color: 'var(--crm-muted)' }}>{n} days</button>)}
      </div>
    </div>
    {data.sampleCount > 0 && <p className="rounded-xl border px-4 py-2 text-xs" style={surface}>{data.sampleCount} sample records excluded from analytics.</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {data.metrics.map((m, i) => { const Icon = icon[i]; return <div key={m.label} className={panel + ' sh-elevate'} style={surface}>
        <div className="flex items-start justify-between gap-2"><span className="text-xs sm:text-sm" style={{ color: 'var(--crm-muted)' }}>{m.label}</span><Icon aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: 'var(--crm-primary)' }}/></div>
        <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{m.available ? m.value.toLocaleString('es-ES') : '—'}</p>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--crm-muted)' }}>{!m.available ? 'Module not configured' : i === 3 ? 'Pending as of today' : 'Created in this period'}</p>
      </div>; })}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
      <div className={panel} style={surface}>
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Lead growth</h3><span className="text-sm font-semibold tabular-nums">{sum} new</span></div>
        <p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>By creation date · last {days} days</p>
        {sum ? <div role="img" aria-label={`Lead growth: ${sum} leads new en los últimos ${days} days`} className="mt-5 flex h-36 items-end gap-[3px] sm:h-44">
          {plotted.map((p) => <div key={p.day} title={`${p.label}: ${p.leads} leads`} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div className="w-full rounded-t bg-[var(--crm-primary)] transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(p.leads ? 6 : 2, p.leads / max * 100)}%`, opacity: p.leads ? 1 : .15 }}/>
          </div>)}
        </div> : <div className="mt-5 flex min-h-36 items-center justify-center rounded-xl border border-dashed p-5 text-center text-sm" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>Todavía no hay leads new con fecha de creación en este periodo.</div>}
        <div className="mt-3 flex justify-between text-[11px]" style={{ color: 'var(--crm-muted)' }}><span>{data.series[0]?.label}</span><span>{data.series[data.series.length - 1]?.label}</span></div>
      </div>
      <div className={panel} style={surface}>
        <h3 className="font-semibold">Next best actions</h3><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Overdue and upcoming tasks</p>
        {data.alerts.length + data.tasks.length ? <ul className="mt-3 space-y-2">
          {[...data.alerts.map((x) => ({ ...x, late: true })), ...data.tasks.map((x) => ({ ...x, late: false }))].slice(0, 5).map((item) =>
            <li key={item.id}><button type="button" onClick={() => onOpen(item.record)} className="sh-focus flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-black/5">
              {item.late ? <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600"/> : <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600"/>}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{item.reason}</span></span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </button></li>)}
        </ul> : <p className="mt-5 rounded-xl border border-dashed p-5 text-center text-sm" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>You're all caught up. No pending tasks or alerts.</p>}
      </div>
    </div>
    <div className={panel} style={surface}>
      <h3 className="font-semibold">Team activity</h3><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Registros con agente o responsable identificado · últimos {days} days</p>
      {data.agents.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm">
        <thead><tr className="border-b text-xs" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}><th className="pb-2 font-medium">Agent</th><th className="pb-2 text-right font-medium">Leads</th><th className="pb-2 text-right font-medium">Viewings</th><th className="pb-2 text-right font-medium">Deals</th></tr></thead>
        <tbody>{data.agents.map((a) => <tr key={a.name} className="border-b last:border-0" style={{ borderColor: 'var(--crm-border)' }}><th scope="row" className="py-3 font-medium">{a.name}</th><td className="text-right tabular-nums">{a.leads}</td><td className="text-right tabular-nums">{a.visits}</td><td className="text-right tabular-nums">{a.opportunities}</td></tr>)}</tbody>
      </table></div> : <p className="mt-4 rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>No assigned agent activity yet. Assign an agent to records to see the breakdown.</p>}
      {data.undatedCount > 0 && <p className="mt-3 text-xs" style={{ color: 'var(--crm-muted)' }}>{data.undatedCount} records without creation dates are excluded from time-based analytics.</p>}
    </div>
  </section>;
}
