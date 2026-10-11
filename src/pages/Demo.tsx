import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, Home } from 'lucide-react';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import type { DemoApp } from '@shared/blueprint/samples.ts';
import { composeApp, modulesFor, sampleRecordsFor } from '@shared/blueprint/modules.ts';
import type { AppRecord, RecordData } from '@shared/blueprint/types.ts';
import { Workspace } from '@/components/crm/Workspace';
import { Presentation3D } from '@/components/crm/Presentation3D';

// Public demo: no account, everything in memory. Every piece on, plus the
// sector templates, so people can feel it before making their own.

const full = (kind: 'crm' | 'erp', sector: string, pitch: string): DemoApp => {
  const blueprint = composeApp(kind, `StateHubs ${kind.toUpperCase()}`, modulesFor(kind).map((m) => m.key));
  return { key: kind, sector, pitch, blueprint, records: sampleRecordsFor(blueprint) };
};
const APPS: DemoApp[] = [
  full('crm', 'CRM completo', 'Leads, embudo, agenda, clientes, presupuestos, soporte y toda la operación.'),
  full('erp', 'ERP completo', 'Facturas y cobros, pedidos, almacén, compras, gastos y toda la operación.'),
  ...DEMO_APPS,
];

export default function Demo() {
  const [key, setKey] = useState(APPS[0].key);
  const app = APPS.find((a) => a.key === key)!;
  const [records, setRecords] = useState<AppRecord[]>(app.records);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => { document.title = 'Demo · StateHubs'; }, []);
  useEffect(() => { setRecords(app.records); }, [app]);

  const create = (entity: string, data: RecordData) => {
    const r: AppRecord = { id: crypto.randomUUID(), entity, data };
    setRecords((rs) => [...rs, r]);
    return r;
  };
  const update = (id: string, data: RecordData) => setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...data } } : r)));
  const remove = (id: string) => setRecords((rs) => rs.filter((r) => r.id !== id));

  const bar = (
    <div className="flex flex-wrap items-center gap-2 border-b bg-ink px-4 py-2 text-sm text-white/80 md:px-6">
      <span className="font-medium text-white">Demo</span>
      <select aria-label="Ejemplo" value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-white">
        {APPS.map((a) => <option key={a.key} value={a.key} className="text-black">{a.sector}</option>)}
      </select>
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{app.pitch} Nada se guarda.</span>
      <Link to="/" className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-medium text-white">Crea el tuyo <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );

  return (
    <div className="h-[100dvh]">
      <Workspace key={app.key} blueprint={app.blueprint} records={records} banner={bar} className="h-full"
        onCreate={create} onUpdate={update} onDelete={remove}
        tools={[
          { key: '3d', label: 'Verlo en 3D', icon: Box, onClick: () => setShow3d(true) },
          { key: 'inicio', label: 'Volver a la portada', icon: Home, onClick: () => { window.location.href = '/'; } },
        ]} />
      {show3d && <Presentation3D blueprint={app.blueprint} records={records} onClose={() => setShow3d(false)} />}
    </div>
  );
}
