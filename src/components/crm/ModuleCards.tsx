import { Boxes, CalendarDays, Check, FileText, Filter, FolderKanban, FolderOpen, Gauge, LifeBuoy, Magnet, Package, Plus, Receipt, Truck, Users, Wallet, Workflow, Zap } from 'lucide-react';
import { LIBRARY, MODULES } from '@shared/blueprint/modules.ts';
import type { ModuleDef } from '@shared/blueprint/modules.ts';

// The "Mr. Potato" pieces: one card per function. Tap to put it on or take it off.

const ICONS = { Magnet, Filter, CalendarDays, Users, FileText, LifeBuoy, Receipt, Package, Boxes, Truck, FolderKanban, Wallet, Gauge, Workflow, FolderOpen, Zap };

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Boxes;
  return <Icon className={className} />;
}

interface Props {
  modules?: ModuleDef[];
  selected: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModuleCards({ modules = MODULES, selected, onToggle, disabled, compact }: Props) {
  return (
    <ul aria-label="Piezas" className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {modules.map((m) => {
        const on = selected.includes(m.key);
        const brings = m.entities.map((k) => LIBRARY[k]?.labelPlural).filter(Boolean).join(', ');
        return (
          <li key={m.key}>
            <button type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(m.key)}
              className={`group flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-60 ${on ? 'border-primary bg-primary/5 shadow-sm' : 'border-dashed border-border bg-card hover:border-primary/50 hover:bg-muted/40'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'}`}>
                <ModuleIcon name={m.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${on ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground'}`}>
                    {on ? <><Check className="h-3 w-3" /> Puesta</> : <><Plus className="h-3 w-3" /> Añadir</>}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{m.pitch}</span>
                {!compact && brings && <span className="mt-1 block text-xs text-muted-foreground/80">Trae: {brings}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
