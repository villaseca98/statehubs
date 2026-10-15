import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { composeApp, composePack, modulesFor, sampleRecordsFor } from '@shared/blueprint/modules.ts';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { Workspace } from './Workspace';
import { openSection, visitAllSections } from './testNav';

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
  it('opens property workspaces on the feed and moves between sections one at a time', () => {
    const bp = composeApp('crm', 'Mi CRM', modulesFor('crm').map((m) => m.key).filter((k) => k !== 'centro'));
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Property feed' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Para hoy' })).toBeNull();

    openSection(/Pipeline/);
    expect(screen.getByRole('heading', { level: 1, name: 'Pipeline' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Para hoy' })).toBeNull();
  });

  it('reads the data in the analysis section: funnel, priorities, patterns and database', () => {
    const bp = composeApp('crm', 'Mi CRM', ['panel', 'analisis', 'leads', 'embudo', 'clientes']);
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    openSection(/Insights/);
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
    expect(screen.getAllByText('Clara V.').length).toBeGreaterThan(0);
  });

  it('opens on one property card even when the operations centre is first, keeping operations reachable', () => {
    const bp = composePack('ambos', 'Inmobiliaria');
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'Property feed' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Cifras del día' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Para hoy' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Nuevo/ })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Workspace tool' })).toHaveValue('');
    openSection('Operations center');
    expect(screen.getByRole('region', { name: 'Cifras del día' })).toBeTruthy();
    expect(screen.getByText('Ocupación hoy')).toBeTruthy();
    expect(screen.getByText('Comisión prevista')).toBeTruthy();
    const avisos = screen.getByRole('region', { name: 'Avisos' });
    expect(within(avisos).getByText(/Reservas solapadas/)).toBeTruthy();
    // A line of today opens its record in the drawer.
    const hoy = screen.getByRole('region', { name: 'Hoy' });
    fireEvent.click(within(hoy).getByRole('button', { name: /Paolo Ricci/ }));
    expect(screen.getAllByDisplayValue('Paolo Ricci').length).toBeGreaterThan(0);
  });

  it('shows the property cards with price, badge and quick filters', () => {
    const bp = composePack('ambos', 'Inmobiliaria');
    render(<Harness blueprint={bp} records={sampleRecordsFor(bp)} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Hubs' })).getByRole('button', { name: 'More' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('button', { name: 'Properties' }));
    const list = screen.getByRole('list', { name: 'Inmuebles' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(within(list).getByText(/118\s€ \/ noche/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Operación' })).getByRole('button', { name: /Venta/ }));
    expect(within(screen.getByRole('list', { name: 'Inmuebles' })).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), { target: { value: 'vendido' } });
    const sold = within(screen.getByRole('list', { name: 'Inmuebles' })).getAllByRole('listitem');
    expect(sold).toHaveLength(1);
    fireEvent.click(within(sold[0]).getByRole('button'));
    expect(screen.getAllByDisplayValue('Plaza Redonda 3, ático').length).toBeGreaterThan(0);
  });

  it('renders every section of every example without crashing', () => {
    const apps = [
      ...(['crm', 'erp'] as const).map((k) => { const b = composeApp(k, 'X', modulesFor(k).map((m) => m.key)); return { blueprint: b, records: sampleRecordsFor(b) }; }),
      ...DEMO_APPS,
    ];
    for (const app of apps) {
      const { unmount } = render(<Harness blueprint={app.blueprint} records={app.records} />);
      visitAllSections();
      unmount();
    }
  });

  describe('filters, search and dark mode', () => {
    beforeEach(() => window.localStorage.clear());
    const bp = composePack('ambos', 'Inmobiliaria');
    const goTo = (label: RegExp) => openSection(label);
    const firstView = () => bp.views.find((v) => v.entity === 'operacion' && v.groupBy)!;

    it('filters a section with presets, rules and the search box, and saves the view', () => {
      const records = sampleRecordsFor(bp);
      render(<Harness blueprint={bp} records={records} />);
      goTo(/Deals/);
      const total = records.filter((r) => r.entity === 'operacion').length;
      expect(screen.getByText(`${total} de ${total}`)).toBeTruthy();

      const tabs = screen.getByRole('tablist', { name: 'Vistas' });
      fireEvent.click(within(tabs).getByRole('tab', { name: 'Casos cerrados' }));
      const closed = records.filter((r) => r.entity === 'operacion' && ['cerrada', 'perdida'].includes(String(r.data.etapa))).length;
      expect(screen.getByText(`${closed} de ${total}`)).toBeTruthy();
      expect(within(tabs).getByRole('tab', { name: 'Casos cerrados' }).getAttribute('aria-selected')).toBe('true');

      // Add a rule by hand: the tab no longer matches and can be saved.
      fireEvent.click(screen.getByRole('button', { name: /Filtro/ }));
      fireEvent.click(screen.getByRole('button', { name: /Añadir regla/ }));
      const rule = screen.getByRole('group', { name: 'Regla 2' });
      fireEvent.change(within(rule).getByLabelText('Campo'), { target: { value: 'titulo' } });
      fireEvent.change(within(rule).getByLabelText('Valor'), { target: { value: 'zzz-nada' } });
      expect(screen.getByText(`0 de ${total}`)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Guardar vista/ }));
      const name = screen.getByLabelText('Nombre de la vista');
      fireEvent.change(name, { target: { value: 'Nada' } });
      fireEvent.keyDown(name, { key: 'Enter' });
      expect(within(tabs).getByRole('tab', { name: 'Nada' }).getAttribute('aria-selected')).toBe('true');
      expect(window.localStorage.getItem(`statehubs.vistas.Inmobiliaria.${firstView().key}`)).toContain('Nada');

      fireEvent.click(within(tabs).getByRole('tab', { name: 'Todo' }));
      expect(screen.getByText(`${total} de ${total}`)).toBeTruthy();
      fireEvent.change(screen.getByLabelText(/Buscar en operaciones/), { target: { value: 'zzz-nada' } });
      expect(screen.getByText(`0 de ${total}`)).toBeTruthy();
    });

    it('finds any record with Ctrl+K and opens it', () => {
      const records = sampleRecordsFor(bp);
      const someone = records.find((r) => r.entity === 'contacto_inmo')!;
      render(<Harness blueprint={bp} records={records} />);
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const box = screen.getByRole('combobox', { name: 'Buscar' });
      fireEvent.change(box, { target: { value: String(someone.data.nombre) } });
      expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(0);
      fireEvent.keyDown(box, { key: 'Enter' });
      expect(screen.queryByRole('dialog', { name: 'Buscar en toda la app' })).toBeNull();
      expect(screen.getAllByDisplayValue(String(someone.data.nombre)).length).toBeGreaterThan(0);
    });

    it('switches to dark mode and remembers it', () => {
      const { container } = render(<Harness blueprint={bp} records={[]} />);
      const app = container.querySelector('[data-app="statehubs"]') as HTMLElement;
      expect(app.dataset.theme).toBe('light');
      fireEvent.click(screen.getAllByRole('button', { name: 'Dark mode' })[0]);
      expect(app.dataset.theme).toBe('dark');
      expect(app.style.getPropertyValue('--crm-bg')).toBe('#111114');
      expect(window.localStorage.getItem('statehubs.tema')).toBe('dark');
    });
  });
});
