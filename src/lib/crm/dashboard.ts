import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { computeToday } from './today';

export type WindowDays = 7 | 30 | 90;
export type DashboardMetric = { label: string; value: number; entity: string; available: boolean };
export type DashboardPoint = { day: string; label: string; leads: number };
export type AgentCount = { name: string; leads: number; visits: number; opportunities: number };
const inRange = (r: AppRecord, start: number, end: number) => {
  if (!r.created_at) return false;
  const ms = Date.parse(r.created_at);
  return Number.isFinite(ms) && ms >= start && ms < end;
};
const label = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const visit = (r: AppRecord) => r.entity === 'visita' || r.entity === 'cita_inmo';
const deal = (r: AppRecord) => r.entity === 'oportunidad' || r.entity === 'operacion';
/** Pure projection of the records currently loaded for this app. No cross-agency queries or fake totals. */
export function dashboardMetrics(blueprint: Blueprint, records: AppRecord[], days: WindowDays, now = new Date()) {
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const start = startDate.getTime(), end = endDate.getTime();
  const has = (keys: string[]) => blueprint.entities.some((e) => keys.includes(e.key));
  const real = records.filter((r) => !r.is_sample);
  const period = real.filter((r) => inRange(r, start, end));
  const leads = period.filter((r) => r.entity === 'lead');
  const visits = period.filter(visit);
  const opportunities = period.filter(deal);
  const today = computeToday(blueprint, real, now);
  const metrics: DashboardMetric[] = [
    { label: 'Leads nuevos', value: leads.length, entity: 'lead', available: has(['lead']) },
    { label: 'Visitas registradas', value: visits.length, entity: 'visita / cita_inmo', available: has(['visita', 'cita_inmo']) },
    { label: 'Oportunidades creadas', value: opportunities.length, entity: 'oportunidad / operacion', available: has(['oportunidad', 'operacion']) },
    { label: 'Tareas por atender', value: today.hoy.length + today.atrasado.length, entity: 'computeToday', available: true },
  ];
  const series: DashboardPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return { day, label: label(day), leads: 0 };
  });
  const byDay = new Map(series.map((p) => [p.day, p]));
  for (const r of leads) {
    const d = new Date(r.created_at!);
    const day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    const point = byDay.get(day);
    if (point) point.leads++;
  }
  // Agent breakdown only where a record explicitly contains an agent identifier.
  const agents = new Map<string, AgentCount>();
  for (const r of period) {
    const name = str(r.data.agente) || str(r.data.agente_asignado) || str(r.data.responsable);
    if (!name || !(r.entity === 'lead' || visit(r) || deal(r))) continue;
    const a = agents.get(name) ?? { name, leads: 0, visits: 0, opportunities: 0 };
    if (r.entity === 'lead') a.leads++;
    if (visit(r)) a.visits++;
    if (deal(r)) a.opportunities++;
    agents.set(name, a);
  }
  return {
    metrics, series, agents: [...agents.values()].sort((a, b) => b.leads + b.visits + b.opportunities - a.leads - a.visits - a.opportunities),
    alerts: today.atrasado.slice(0, 4), tasks: today.hoy.slice(0, 4),
    sampleCount: records.length - real.length,
    undatedCount: real.filter((r) => (r.entity === 'lead' || visit(r) || deal(r)) && !r.created_at).length,
  };
}
