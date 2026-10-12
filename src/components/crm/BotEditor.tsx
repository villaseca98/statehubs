import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, BedDouble, CalendarCheck, GripVertical, Plus, Trash2, UserRound, X } from 'lucide-react';
import type { Blueprint, BotChoice, BotConfig, BotQuestion, BotRule, BotRuleOp, BotTarget, BotTemplate, Field } from '@shared/blueprint/types.ts';
import { BOT_FIELD_TYPES, BOT_RESERVED, BOT_TEMPLATES, agendaReady, botTemplate, reservaReady } from '@shared/blueprint/bot.ts';

// The assistant's flow, edited by hand: what starts it, what it says, the
// questions (drag to reorder), how it scores and how it ends. It only edits a
// draft; the page saves it as a proposal like any other change.

const TARGET_LABEL: Record<BotTarget, string> = { contacto_inmo: 'Contacto', conversacion: 'Conversación' };
const OP_LABEL: Record<BotRuleOp, string> = { eq: 'es', gte: 'es al menos', lte: 'es como mucho', filled: 'tiene respuesta' };
const NUMERIC = new Set(['number', 'money', 'percent']);

const input = 'w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary';

function allowedFields(bp: Blueprint): { target: BotTarget; field: Field }[] {
  const out: { target: BotTarget; field: Field }[] = [];
  for (const target of ['contacto_inmo', 'conversacion'] as BotTarget[]) {
    const e = bp.entities.find((x) => x.key === target);
    for (const f of e?.fields ?? []) if (BOT_FIELD_TYPES.includes(f.type) && !BOT_RESERVED[target].includes(f.key)) out.push({ target, field: f });
  }
  return out;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function BotEditor({ blueprint, draft, onChange }: { blueprint: Blueprint; draft: BotConfig; onChange: (b: BotConfig) => void }) {
  const fields = useMemo(() => allowedFields(blueprint), [blueprint]);
  const set = (patch: Partial<BotConfig>) => onChange({ ...draft, ...patch });
  const [keyword, setKeyword] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const fieldOf = (t: BotTarget, k: string) => fields.find((x) => x.target === t && x.field.key === k)?.field
    ?? blueprint.entities.find((e) => e.key === t)?.fields.find((f) => f.key === k);
  const citaTipos = blueprint.entities.find((e) => e.key === 'cita_inmo')?.fields.find((f) => f.key === 'tipo')?.options ?? [];

  const addKeyword = () => {
    const k = keyword.trim().toUpperCase();
    if (k.length >= 2 && !draft.keywords.some((x) => x.toUpperCase() === k)) set({ keywords: [...draft.keywords, k].slice(0, 20) });
    setKeyword('');
  };
  const setQuestion = (i: number, q: BotQuestion) => set({ questions: draft.questions.map((x, j) => (j === i ? q : x)) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.questions.length || from === to) return;
    const qs = [...draft.questions];
    const [q] = qs.splice(from, 1);
    qs.splice(to, 0, q);
    set({ questions: qs });
  };
  const addQuestion = () => {
    const used = new Set(draft.questions.map((q) => q.key));
    let n = draft.questions.length + 1;
    while (used.has(`pregunta_${n}`)) n++;
    const first = fields.find((f) => !draft.questions.some((q) => q.entity === f.target && q.field === f.field.key)) ?? fields[0];
    if (!first) return;
    set({ questions: [...draft.questions, { key: `pregunta_${n}`, text: `¿${first.field.label}?`, entity: first.target, field: first.field.key }] });
  };
  const setRule = (i: number, r: BotRule) => set({ rules: draft.rules.map((x, j) => (j === i ? r : x)) });

  const fieldSelect = (target: BotTarget, key: string, onPick: (t: BotTarget, k: string) => void, label: string) => (
    <select aria-label={label} className={input} value={`${target}.${key}`} onChange={(e) => { const [t, k] = e.target.value.split('.'); onPick(t as BotTarget, k); }}>
      {(['contacto_inmo', 'conversacion'] as BotTarget[]).map((t) => (
        <optgroup key={t} label={TARGET_LABEL[t]}>
          {fields.filter((f) => f.target === t).map((f) => <option key={f.field.key} value={`${t}.${f.field.key}`}>{f.field.label}</option>)}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <Section title="Plantilla" hint="Empieza por la que se parezca a tu negocio y cámbiala a tu gusto.">
        <div className="grid gap-2 sm:grid-cols-3">
          {BOT_TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => { if (t.key !== draft.template && window.confirm(`¿Empezar desde «${t.name}»? Se cambia el flujo que estás editando (nada se guarda hasta que lo propongas).`)) onChange({ ...botTemplate(blueprint, t.key as BotTemplate), enabled: draft.enabled }); }}
              aria-pressed={draft.template === t.key}
              className={`rounded-xl border p-3 text-left text-sm transition hover:border-primary ${draft.template === t.key ? 'border-primary bg-primary/5' : ''}`}>
              <span className="block font-medium">{t.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.pitch}</span>
            </button>
          ))}
        </div>
        <Toggle label="Asistente encendido" checked={draft.enabled} onChange={(enabled) => set({ enabled })} />
      </Section>

      <Section title="Cuándo empieza" hint="Comentan una palabra clave en un post o reel y les escribe por privado. También contesta a historias y anuncios.">
        <div className="flex flex-wrap gap-1.5">
          {draft.keywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
              {k}<button type="button" aria-label={`Quitar ${k}`} onClick={() => set({ keywords: draft.keywords.filter((x) => x !== k) })}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); addKeyword(); }}>
            <input aria-label="Nueva palabra clave" value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={30} placeholder="Añadir palabra…" className="w-36 rounded-full border bg-background px-3 py-1 text-sm outline-none focus:border-primary" />
          </form>
        </div>
        <Toggle label="Contestar también a mensajes directos sin palabra clave" checked={draft.anyDm} onChange={(anyDm) => set({ anyDm })} />
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Respuesta pública bajo el comentario (opcional)</span>
          <input className={input} maxLength={300} value={draft.commentReply ?? ''} onChange={(e) => set({ commentReply: e.target.value || undefined })} placeholder="¡Te escribo por privado! 📩" />
        </label>
      </Section>

      <Section title="Bienvenida" hint="{negocio} pone el nombre de tu inmobiliaria.">
        <textarea aria-label="Mensaje de bienvenida" className={`${input} min-h-[76px]`} maxLength={600} value={draft.welcome} onChange={(e) => set({ welcome: e.target.value })} />
      </Section>

      <Section title="Preguntas" hint="En este orden. Arrástralas para cambiarlo. Cada respuesta se guarda en la ficha del contacto o de la conversación.">
        <ol className="flex flex-col gap-2">
          {draft.questions.map((q, i) => {
            const f = fieldOf(q.entity, q.field);
            return (
              <li key={q.key} draggable onDragStart={() => setDragging(i)} onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragging !== null) move(dragging, i); setDragging(null); }}
                className={`rounded-xl border bg-background p-3 transition ${dragging === i ? 'opacity-50' : ''}`} aria-label={`Pregunta ${i + 1}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 flex shrink-0 cursor-grab items-center gap-1 text-muted-foreground" title="Arrastra para cambiar el orden"><GripVertical className="h-4 w-4" /><span className="text-xs font-semibold">{i + 1}</span></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input aria-label={`Texto de la pregunta ${i + 1}`} className={input} maxLength={300} value={q.text} onChange={(e) => setQuestion(i, { ...q, text: e.target.value })} />
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                      <span className="text-xs text-muted-foreground">Guarda en</span>
                      {fieldSelect(q.entity, q.field, (t, k) => setQuestion(i, { ...q, entity: t, field: k, options: undefined }), `Dónde guarda la pregunta ${i + 1}`)}
                    </div>
                    {f && <ChoicesEditor field={f} options={q.options ?? []} onChange={(options) => setQuestion(i, { ...q, options: options.length ? options : undefined })} />}
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={!!q.optional} onChange={(e) => setQuestion(i, { ...q, optional: e.target.checked || undefined })} /> Se puede saltar («prefiero no»)
                    </label>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Bajar" disabled={i === draft.questions.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Quitar la pregunta ${i + 1}`} onClick={() => set({ questions: draft.questions.filter((_, j) => j !== i) })} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {draft.questions.length < 10 && <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm"><Plus className="h-4 w-4" /> Añadir pregunta</button>}
      </Section>

      <Section title="Puntuación" hint="Cada regla suma o resta puntos (0 a 100). Con eso decide si es caliente y si le ofrece cita.">
        <ul className="flex flex-col gap-2">
          {draft.rules.map((r, i) => {
            const f = fieldOf(r.entity, r.field);
            const ops: BotRuleOp[] = f && NUMERIC.has(f.type) ? ['gte', 'lte', 'eq', 'filled'] : ['eq', 'filled'];
            return (
              <li key={i} className="grid grid-cols-2 items-center gap-2 rounded-xl border bg-background p-2.5 sm:grid-cols-[1.3fr_1fr_1fr_84px_auto]">
                {fieldSelect(r.entity, r.field, (t, k) => setRule(i, { ...r, entity: t, field: k, op: 'filled', value: undefined }), `Campo de la regla ${i + 1}`)}
                <select aria-label={`Condición de la regla ${i + 1}`} className={input} value={r.op} onChange={(e) => setRule(i, { ...r, op: e.target.value as BotRuleOp })}>
                  {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                </select>
                {r.op === 'filled' ? <span className="text-xs text-muted-foreground">—</span>
                  : f?.type === 'select' ? (
                    <select aria-label={`Valor de la regla ${i + 1}`} className={input} value={String(r.value ?? '')} onChange={(e) => setRule(i, { ...r, value: e.target.value })}>
                      <option value="">Elige…</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input aria-label={`Valor de la regla ${i + 1}`} className={input} inputMode={f && NUMERIC.has(f.type) ? 'numeric' : undefined} value={String(r.value ?? '')}
                      onChange={(e) => setRule(i, { ...r, value: f && NUMERIC.has(f.type) && e.target.value !== '' ? Number(e.target.value) : e.target.value })} />
                  )}
                <label className="flex items-center gap-1 text-sm">
                  <input aria-label={`Puntos de la regla ${i + 1}`} type="number" min={-100} max={100} className={`${input} tabular-nums`} value={r.points}
                    onChange={(e) => setRule(i, { ...r, points: Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
                  <span className="text-xs text-muted-foreground">pts</span>
                </label>
                <button type="button" aria-label={`Quitar la regla ${i + 1}`} onClick={() => set({ rules: draft.rules.filter((_, j) => j !== i) })} className="justify-self-end rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
        {draft.rules.length < 15 && fields[0] && (
          <button type="button" onClick={() => set({ rules: [...draft.rules, { entity: fields[0].target, field: fields[0].field.key, op: 'filled', points: 10 }] })} className="inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm"><Plus className="h-4 w-4" /> Añadir regla</button>
        )}
        <div className="grid grid-cols-3 gap-2">
          {([['hot', 'Caliente desde'], ['warm', 'Templado desde'], ['qualify', 'Le ofrece el final desde']] as const).map(([k, label]) => (
            <label key={k} className="text-xs text-muted-foreground">
              <span className="mb-1 block min-h-[2.2em]">{label}</span>
              <input type="number" min={0} max={100} aria-label={label} className={`${input} tabular-nums`} value={draft[k]} onChange={(e) => set({ [k]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } as Partial<BotConfig>)} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Al final" hint="Cuando ha contestado y llega a la puntuación.">
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ['agenda', CalendarCheck, 'Darle cita', 'Ofrece huecos libres de tu agenda y la deja apuntada.', agendaReady(blueprint), 'Necesita la Agenda y horario en Contactos.'],
            ['reserva', BedDouble, 'Guardar la reserva', 'Pregunta fechas y personas y deja una prerreserva por confirmar. Nunca cobra.', reservaReady(blueprint) || !!blueprint.entities.some((e) => e.key === 'reserva'), 'Necesita la pieza Alquiler turístico.'],
            ['humano', UserRound, 'Pasarlo a una persona', 'Da las gracias y te lo deja en la bandeja.', true, ''],
          ] as const).map(([mode, Icon, name, pitch, ok, why]) => (
            <button key={mode} type="button" disabled={!ok} aria-pressed={draft.finish.mode === mode} onClick={() => set({ finish: { ...draft.finish, mode, citaTipo: mode === 'agenda' ? draft.finish.citaTipo ?? 'visita' : undefined } })}
              className={`rounded-xl border p-3 text-left text-sm transition enabled:hover:border-primary disabled:opacity-50 ${draft.finish.mode === mode ? 'border-primary bg-primary/5' : ''}`}>
              <Icon className="mb-1 h-4 w-4 text-primary" />
              <span className="block font-medium">{name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{ok ? pitch : why}</span>
            </button>
          ))}
        </div>
        {draft.finish.mode === 'agenda' && citaTipos.length > 0 && (
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo de cita (a quien quiere vender le da tasación)</span>
            <select className={input} value={draft.finish.citaTipo ?? ''} onChange={(e) => set({ finish: { ...draft.finish, citaTipo: e.target.value || undefined } })}>
              {citaTipos.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">{draft.finish.mode === 'agenda' ? 'Mensaje con los huecos' : draft.finish.mode === 'reserva' ? 'Pregunta por la fecha de llegada' : 'Mensaje final'}</span>
          <input className={input} maxLength={400} value={draft.finish.text ?? ''} onChange={(e) => set({ finish: { ...draft.finish, text: e.target.value || undefined } })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Despedida</span>
          <input className={input} maxLength={400} value={draft.goodbye} onChange={(e) => set({ goodbye: e.target.value })} />
        </label>
      </Section>
    </div>
  );
}

// Quick-reply buttons for a question: a select offers its options, an amount
// takes a label and a number, a text just the words to tap.
function ChoicesEditor({ field, options, onChange }: { field: Field; options: BotChoice[]; onChange: (o: BotChoice[]) => void }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  if (field.type === 'select') {
    return (
      <div className="flex flex-wrap gap-1.5" aria-label="Respuestas rápidas">
        {(field.options ?? []).map((o) => {
          const on = options.some((x) => x.value === o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? options.filter((x) => x.value !== o.value) : [...options, { label: o.label.slice(0, 20), value: o.value }].slice(0, 8))}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              {o.label}
            </button>
          );
        })}
        <span className="self-center text-[11px] text-muted-foreground">{options.length ? 'Botones de respuesta rápida' : 'Sin botones: escribe lo que quiera'}</span>
      </div>
    );
  }
  const numeric = NUMERIC.has(field.type);
  const add = () => {
    const l = label.trim().slice(0, 20);
    const v = numeric ? value.trim() : l;
    if (!l || (numeric && !Number.isFinite(Number(v))) || options.length >= 8) return;
    onChange([...options, { label: l, value: v }]);
    setLabel(''); setValue('');
  };
  return (
    <div className="flex flex-col gap-1.5">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <span key={o.label} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
              {o.label}{numeric && <span className="text-muted-foreground">= {Number(o.value).toLocaleString('es-ES')}</span>}
              <button type="button" aria-label={`Quitar ${o.label}`} onClick={() => onChange(options.filter((x) => x !== o))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      {['email', 'phone', 'date', 'longtext'].includes(field.type) ? null : (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input aria-label="Texto del botón" maxLength={20} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Botón (máx. 20)" className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
          {numeric && <input aria-label="Valor del botón" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor" className="w-24 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />}
          <button type="submit" className="rounded-lg border px-2 text-xs">Añadir</button>
        </form>
      )}
    </div>
  );
}
