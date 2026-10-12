import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { composeApp, modulesFor, sampleRecordsFor } from '@shared/blueprint/modules.ts';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { Workspace } from './Workspace';

function Harness({ blueprint, records: initial }: { blueprint: Blueprint; records: AppRecord[] }) {
  const [records, setRecords] = useState(initial);
  return (
    <div style={{ height: 800 }}>
      <Workspace blueprint={blueprint} records={records}
        onCreate={(entity, data) => { const r = { id: `n${records.length}`, entity, data }; setRecords((rs) => [...rs, r]); return r; }}
        onUpdate={(id, data) => setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...data } } : r)))}
        onDelete={(id) => setRecords((rs) => rs.filter((r) => r.id !== id))} />
    </div>
  );
}

describe('Workspace', () => {
  it('opens on «Hoy» and moves between sections one at a time', () => {
    const bp = composeApp('crm', 'Mi CRM', modulesFor('crm').map((m) => m.key));
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Para hoy' })).toBeTruthy();

    const nav = screen.getAllByRole('navigation', { name: 'Secciones' })[0];
    fireEvent.click(within(nav).getByRole('button', { name: /Embudo/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Embudo' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Para hoy' })).toBeNull();
  });

  it('reads the data in the analysis section: funnel, priorities, patterns and database', () => {
    const bp = composeApp('crm', 'Mi CRM', ['panel', 'analisis', 'leads', 'embudo', 'clientes']);
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    const nav = screen.getAllByRole('navigation', { name: 'Secciones' })[0];
    fireEvent.click(within(nav).getByRole('button', { name: /Análisis/ }));
    const lenses = screen.getByRole('tablist', { name: 'Enfoques' });
    expect(screen.getByText('Previsión de cierre')).toBeTruthy();
    fireEvent.click(within(lenses).getByRole('tab', { name: 'A quién atacar hoy' }));
    expect(screen.getByRole('region', { name: 'Prioridad de hoy' })).toBeTruthy();
    fireEvent.click(within(lenses).getByRole('tab', { name: 'Base de datos' }));
    expect(screen.getAllByRole('button', { name: /en CSV/ }).length).toBeGreaterThan(0);
  });

  it('opens a record from «Hoy» in the side drawer and edits it', () => {
    const bp = composeApp('crm', 'Mi CRM', ['panel', 'leads']);
    const records: AppRecord[] = [{ id: 'l1', entity: 'lead', data: { nombre: 'Clara Vidal', estado: 'nuevo' } }];
    render(<Harness blueprint={bp} records={records} />);
    fireEvent.click(within(screen.getByRole('region', { name: 'Para hoy' })).getByRole('button', { name: /Clara Vidal/ }));
    const name = screen.getAllByDisplayValue('Clara Vidal')[0];
    fireEvent.change(name, { target: { value: 'Clara V.' } });
    fireEvent.blur(name);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText('Clara V.')).toBeTruthy();
  });

  it('renders every section of every example without crashing', () => {
    const apps = [
      ...(['crm', 'erp'] as const).map((k) => { const b = composeApp(k, 'X', modulesFor(k).map((m) => m.key)); return { blueprint: b, records: sampleRecordsFor(b) }; }),
      ...DEMO_APPS,
    ];
    for (const app of apps) {
      const { unmount } = render(<Harness blueprint={app.blueprint} records={app.records} />);
      const nav = screen.getAllByRole('navigation', { name: 'Secciones' })[0];
      for (const b of within(nav).getAllByRole('button')) fireEvent.click(b);
      unmount();
    }
  });
});
