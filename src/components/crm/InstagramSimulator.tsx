import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, BatteryFull, BedDouble, Bookmark, Building2, CalendarCheck, ChevronLeft, Flame, Heart, MessageCircle, PenLine, Phone, RotateCcw, Send, Signal, UserPlus, UserRound, Video, Wifi, XCircle } from 'lucide-react';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import { applyBotOps, runBot } from '@shared/blueprint/bot.ts';
import type { BotEventKind } from '@shared/blueprint/bot.ts';
import { BRAND } from '@shared/blueprint/look.ts';
import { chipStyle } from './theme';

// The assistant as the client sees it on their phone, running the very same
// engine as the server (bot.ts). You write as if you were the lead; what the
// assistant decides is saved in the app for real: the contact, the
// conversation, the visit or the booking.

type Who = 'lead' | 'bot' | 'system';
interface Msg { id: number; who: Who; text: string; quick?: string[]; shortcut?: boolean; time: string }
interface FeedItem { id: number; text: string; time: string }
type Start = 'comment' | 'story' | 'dm';

export interface SimulatorProps {
  blueprint: Blueprint;   // with the assistant being tried (maybe unsaved)
  records: AppRecord[];
  onCreate: (entity: string, data: RecordData) => Promise<AppRecord | void> | AppRecord | void;
  onUpdate: (id: string, patch: RecordData) => void;
  disabled?: string;      // why it can't run right now
}

const LEADS = [['Lucía Prieto', 'lucia.prieto'], ['Marc Soler', 'marcsoler_'], ['Irene Vidal', 'irene.vidal.vlc'], ['Álvaro Ruiz', 'alvaroruiz'], ['Carmen Ferrer', 'carmen.ferrer']];
const hhmm = () => new Date().toTimeString().slice(0, 5);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LEAD_BUBBLE = 'linear-gradient(135deg, #7a5cff 0%, #4f7bff 55%, #3a9bff 100%)';

function feedIcon(text: string): { icon: LucideIcon; color: string } {
  if (/^Contacto nuevo|^Nueva conversación/.test(text)) return { icon: UserPlus, color: '#2563eb' };
  if (/^Puntuación/.test(text)) return { icon: Flame, color: '#ea580c' };
  if (/^Cita creada/.test(text)) return { icon: CalendarCheck, color: '#7c3aed' };
  if (/^Reserva pendiente/.test(text)) return { icon: BedDouble, color: '#059669' };
  if (/^Cualificado/.test(text)) return { icon: BadgeCheck, color: '#0d9488' };
  if (/persona/.test(text)) return { icon: UserRound, color: '#b45309' };
  if (/^Descartado/.test(text)) return { icon: XCircle, color: '#6b7280' };
  return { icon: PenLine, color: '#64748b' };
}

const handleOf = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'tuinmobiliaria';

function Avatar({ text, size = 28, ring }: { text: string; size?: number; ring?: boolean }) {
  const inner = (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})` }}>
      {text.charAt(0).toUpperCase()}
    </span>
  );
  return ring ? <span className="rounded-full p-[2px]" style={{ background: `conic-gradient(from 200deg, ${BRAND.from}, ${BRAND.to}, #ffb347, ${BRAND.from})` }}><span className="block rounded-full bg-white p-[2px]">{inner}</span></span> : inner;
}

export function InstagramSimulator({ blueprint, records, onCreate, onUpdate, disabled }: SimulatorProps) {
  const props = useRef({ blueprint, records, onCreate, onUpdate });
  props.current = { blueprint, records, onCreate, onUpdate };
  const bot = blueprint.bot;
  const business = handleOf(blueprint.name);
  const tourist = bot?.finish.mode === 'reserva' || bot?.template === 'reservas';
  const keyword = bot?.keywords[0] ?? 'INFO';

  const [round, setRound] = useState(0);
  const lead = LEADS[round % LEADS.length];
  const [igId, setIgId] = useState(() => `sim-${Date.now()}`);
  const [start, setStart] = useState<Start>('comment');
  const [phase, setPhase] = useState<'start' | 'dm'>('start');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [comments, setComments] = useState<{ who: string; text: string; reply?: boolean }[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const seq = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [msgs, typing]);

  const conv = useMemo(() => records.find((r) => r.entity === 'conversacion' && r.data.ig_id === igId), [records, igId]);
  const contact = useMemo(() => records.find((r) => r.id === conv?.data.contacto), [records, conv]);
  const convE = blueprint.entities.find((e) => e.key === 'conversacion');
  const contactE = blueprint.entities.find((e) => e.key === 'contacto_inmo');
  const estado = convE?.fields.find((f) => f.key === 'estado')?.options?.find((o) => o.value === conv?.data.estado);
  const temp = contactE?.fields.find((f) => f.key === 'temperatura')?.options?.find((o) => o.value === contact?.data.temperatura);

  const push = (who: Who, text: string, quick?: string[], shortcut?: boolean) => setMsgs((m) => [...m, { id: ++seq.current, who, text, quick, shortcut, time: hhmm() }]);
  const note = (text: string) => setFeed((f) => [{ id: ++seq.current, text, time: hhmm() }, ...f].slice(0, 40));

  const run = async (kind: BotEventKind, text: string) => {
    const now = props.current;
    let n = 0;
    const turn = runBot(now.blueprint, now.records, { kind, text, username: lead[1], name: lead[0], igId }, { now: new Date(), newId: () => `sim-new-${Date.now()}-${++n}` });
    await applyBotOps(turn.ops, {
      create: async (entity, data) => { const r = await now.onCreate(entity, data); return r && 'id' in r ? r.id : `sim-${entity}-${Date.now()}-${++n}`; },
      update: async (id, patch) => { now.onUpdate(id, patch); },
    });
    return turn;
  };

  const send = async (kind: BotEventKind, text: string) => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    setDraft('');
    try {
      if (kind === 'comment') setComments((c) => [...c, { who: lead[1], text: t }]);
      else push('lead', kind === 'story' ? `Respondió a tu historia · ${t}` : t);
      const turn = await run(kind, t);
      turn.notes.forEach(note);
      if (!turn.handled) {
        if (kind === 'comment') { note('Comentario sin palabra clave: el asistente no contesta'); return; }
        note('Mensaje guardado en la conversación: lo contesta una persona');
        push('system', phase === 'start' && !conv ? 'Sin palabra clave no empieza. Prueba con una de las de tu flujo.' : 'El asistente ya ha terminado: ahora lo lleva una persona de tu equipo.');
        if (phase === 'start') setPhase('dm');
        return;
      }
      if (kind === 'comment') {
        await wait(500);
        if (turn.publicReply) setComments((c) => [...c, { who: business, text: `@${lead[1]} ${turn.publicReply}`, reply: true }]);
        await wait(900);
        if (!alive.current) return;
        setPhase('dm');
        push('system', `Respuesta privada a tu comentario: «${t}»`);
      } else setPhase('dm');
      for (const m of turn.replies) {
        setTyping(true);
        await wait(Math.min(1700, 550 + m.text.length * 9));
        if (!alive.current) return;
        setTyping(false);
        // A private reply carries its choices as text («Responde: …»); the simulator offers them as shortcuts.
        const shortcuts = !m.quick && /\n\nResponde: (.+)$/.exec(m.text)?.[1].split(' · ');
        push('bot', shortcuts ? m.text.replace(/\n\nResponde: .+$/, '') : m.text, m.quick ?? (shortcuts || undefined), !!shortcuts);
        await wait(180);
      }
    } finally {
      setTyping(false);
      setBusy(false);
    }
  };

  const reset = () => {
    setRound((r) => r + 1);
    setIgId(`sim-${Date.now()}`);
    setPhase('start');
    setMsgs([]); setFeed([]); setComments([]); setDraft('');
  };

  const lastBot = [...msgs].reverse().find((m) => m.who !== 'system');
  const quick = lastBot?.who === 'bot' ? lastBot.quick : undefined;

  return (
    <div className="flex flex-col items-center gap-4 xl:flex-row xl:items-start xl:justify-center">
      <style>{'@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
      <div className="flex w-full max-w-[380px] flex-col gap-3">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Cómo empieza" className="flex flex-1 rounded-full border bg-background p-0.5 text-xs">
            {([['comment', 'Comentario'], ['story', 'Historia'], ['dm', 'Mensaje']] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={start === k} disabled={phase !== 'start' || busy} onClick={() => setStart(k)}
                className={`flex-1 rounded-full px-2 py-1.5 font-medium transition ${start === k ? 'bg-foreground text-background' : 'text-muted-foreground'} disabled:opacity-60`}>{label}</button>
            ))}
          </div>
          <button onClick={reset} disabled={busy} className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50" title="Otro cliente, desde cero"><RotateCcw className="h-3.5 w-3.5" /> Otra vez</button>
        </div>

        {/* The phone */}
        <div className="rounded-[2.75rem] p-[10px] shadow-[0_30px_80px_-20px_rgba(11,16,32,.55)]" style={{ background: '#0b1020' }} aria-label="Simulador de Instagram">
          <div className="relative flex h-[min(680px,calc(100dvh-210px))] min-h-[520px] flex-col overflow-hidden rounded-[2.2rem] bg-white text-[#0f1419]">
            <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[12px] font-semibold">
              <span>9:41</span>
              <span className="absolute left-1/2 top-2 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0b1020]" aria-hidden />
              <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><BatteryFull className="h-4 w-4" /></span>
            </div>

            {phase === 'start' && start === 'comment' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-[#efefef] px-3 py-2">
                  <Avatar text={blueprint.name} size={30} ring />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{business}</span><span className="block text-[11px] text-[#737373]">Valencia</span></span>
                  <span className="text-lg leading-none">···</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="relative grid aspect-[4/4.2] place-items-center overflow-hidden text-white" style={{ background: tourist ? 'linear-gradient(160deg,#0ea5e9 0%,#38bdf8 35%,#fde68a 100%)' : 'linear-gradient(160deg,#1f2937 0%,#7c2d12 55%,#f59e0b 100%)' }}>
                    <Building2 className="absolute -bottom-6 -right-4 h-48 w-48 opacity-15" />
                    <div className="px-6 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-[.2em] opacity-80">{tourist ? 'Reserva directa' : 'Nuevo en cartera'}</div>
                      <div className="mt-2 text-[26px] font-bold leading-tight">{tourist ? 'Ático con terraza en Ruzafa' : 'Piso reformado en Ruzafa'}</div>
                      <div className="mt-2 text-[15px] opacity-90">{tourist ? 'Hasta 6 personas · desde 165 €/noche' : '3 hab · 88 m² · 245.000 €'}</div>
                      <div className="mx-auto mt-4 inline-block rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-[#0f1419]">Comenta «{keyword}» 👇</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-3 pt-2.5"><Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="ml-auto h-6 w-6" /></div>
                  <div className="px-3 pb-2 pt-1.5 text-[13px]">
                    <div className="font-semibold">1.204 Me gusta</div>
                    <p className="mt-0.5"><b>{business}</b> {tourist ? 'Escápate a Valencia sin comisiones de plataforma ☀️' : 'Luz, terraza y a dos calles del mercado ✨'} Comenta <b>{keyword}</b> y te escribo por privado {tourist ? 'con la disponibilidad' : 'con fotos y huecos para verlo'}.</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      <li><b>sergio.vlc</b> Qué pasada de luz 😍</li>
                      {comments.map((c, i) => (
                        <li key={i} className={c.reply ? 'pl-5 text-[#0f1419]' : ''} style={c.reply ? undefined : { animation: 'fadeIn .3s ease' }}><b>{c.who}</b> {c.text}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <form className="flex items-center gap-2 border-t border-[#efefef] px-3 py-2" onSubmit={(e) => { e.preventDefault(); void send('comment', draft); }}>
                  <Avatar text={lead[0]} size={28} />
                  <input aria-label="Comentario" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy || !!disabled} placeholder={`Comenta como ${lead[1]}…`} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8e8e8e]" />
                  <button disabled={busy || !draft.trim() || !!disabled} className="text-[13px] font-semibold text-[#0095f6] disabled:opacity-40">Publicar</button>
                </form>
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-3">
                  {(bot?.keywords ?? []).slice(0, 4).map((k) => (
                    <button key={k} disabled={busy || !!disabled} onClick={() => void send('comment', k)} className="shrink-0 rounded-full border border-[#dbdbdb] px-3 py-1 text-[12px] font-medium disabled:opacity-40">Comentar «{k}»</button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'start' && start === 'story' && (
              <div className="relative m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl text-white" style={{ background: `linear-gradient(170deg, ${BRAND.to} 0%, ${BRAND.from} 45%, #ffb347 100%)` }}>
                <div className="flex gap-1 px-3 pt-3"><span className="h-0.5 flex-1 rounded bg-white" /><span className="h-0.5 flex-1 rounded bg-white/40" /></div>
                <div className="flex items-center gap-2 px-3 pt-2 text-[13px]"><Avatar text={blueprint.name} size={26} /><b>{business}</b><span className="opacity-70">3 h</span></div>
                <div className="grid flex-1 place-items-center px-6 text-center">
                  <div>
                    <div className="text-[28px] font-bold leading-tight">{tourist ? '¿Te escapas este puente?' : '¿Buscas casa en Valencia?'}</div>
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold text-[#0f1419] shadow-lg">Responde «{keyword}» y te ayudo 👇</div>
                  </div>
                </div>
                <form className="flex items-center gap-2 px-3 pb-3" onSubmit={(e) => { e.preventDefault(); void send('story', draft); }}>
                  <input aria-label="Responder a la historia" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy || !!disabled} placeholder="Enviar mensaje" className="min-w-0 flex-1 rounded-full border border-white/70 bg-transparent px-4 py-2 text-[13px] outline-none placeholder:text-white/80" />
                  <button aria-label="Enviar" disabled={busy || !draft.trim() || !!disabled} className="disabled:opacity-50"><Send className="h-6 w-6" /></button>
                </form>
                <div className="flex gap-1.5 px-3 pb-3">
                  {['😍', keyword, tourist ? '¿Precio?' : '¿Dónde está?'].map((k) => <button key={k} disabled={busy || !!disabled} onClick={() => void send('story', k)} className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-medium backdrop-blur disabled:opacity-40">{k}</button>)}
                </div>
              </div>
            )}

            {(phase === 'dm' || start === 'dm') && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2.5 border-b border-[#efefef] px-3 py-2">
                  <ChevronLeft className="h-6 w-6" />
                  <Avatar text={blueprint.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{blueprint.name.replace(/\s*\(.*\)\s*$/, '')}</span>
                    <span className="block truncate text-[11px] text-[#737373]">{business} · Asistente</span>
                  </span>
                  <Phone className="h-5 w-5" /><Video className="ml-2 h-6 w-6" />
                </div>
                <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-live="polite">
                  <div className="mb-3 flex flex-col items-center gap-1 pt-2 text-center">
                    <Avatar text={blueprint.name} size={64} />
                    <div className="mt-1 text-[15px] font-semibold">{blueprint.name.replace(/\s*\(.*\)\s*$/, '')}</div>
                    <div className="text-[12px] text-[#737373]">{business} · Inmobiliaria</div>
                  </div>
                  {msgs.length === 0 && start === 'dm' && <p className="mt-auto text-center text-[12px] text-[#737373]">Escribe como si fueras un cliente: «Hola, ¿tenéis pisos en Ruzafa?»</p>}
                  {msgs.map((m, i) => {
                    if (m.who === 'system') return <div key={m.id} className="my-2 text-center text-[11px] text-[#737373]">{m.text}</div>;
                    const mine = m.who === 'lead';
                    const nextSame = msgs[i + 1]?.who === m.who;
                    return (
                      <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'} ${nextSame ? '' : 'mb-1.5'}`} style={{ animation: 'fadeIn .25s ease' }}>
                        {!mine && (nextSame ? <span className="w-7 shrink-0" /> : <Avatar text={blueprint.name} size={28} />)}
                        <div className={`max-w-[78%] whitespace-pre-line px-3.5 py-2 text-[14px] leading-snug ${mine ? 'rounded-[22px] rounded-br-md text-white' : 'rounded-[22px] rounded-bl-md bg-[#efefef]'}`}
                          style={mine ? { background: LEAD_BUBBLE } : undefined}>{m.text}</div>
                      </div>
                    );
                  })}
                  {typing && (
                    <div className="flex items-end gap-1.5" aria-label="Escribiendo">
                      <Avatar text={blueprint.name} size={28} />
                      <div className="flex gap-1 rounded-[22px] rounded-bl-md bg-[#efefef] px-4 py-3">
                        {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#8e8e8e]" style={{ animationDelay: `${d * 140}ms` }} />)}
                      </div>
                    </div>
                  )}
                </div>
                {quick && !typing && (
                  <div className="px-3 pb-1">
                    {lastBot?.shortcut && <div className="mb-1 text-[10px] text-[#8e8e8e]">Atajos del simulador: en una respuesta a un comentario Instagram no pone botones, el cliente lo escribe.</div>}
                    <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Respuestas rápidas">
                      {quick.map((q) => (
                        <button key={q} disabled={busy} onClick={() => void send('dm', q)} className="shrink-0 rounded-full border border-[#dbdbdb] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#3a6dff] transition hover:bg-[#f5f7ff] disabled:opacity-40">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                <form className="flex items-center gap-2 px-3 pb-4 pt-1" onSubmit={(e) => { e.preventDefault(); void send('dm', draft); }}>
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#dbdbdb] px-3 py-2">
                    <Avatar text={lead[0]} size={24} />
                    <input aria-label="Mensaje" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy || !!disabled} placeholder="Mensaje…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#8e8e8e]" />
                  </div>
                  <button disabled={busy || !draft.trim() || !!disabled} className="text-[14px] font-semibold text-[#0095f6] disabled:opacity-40">Enviar</button>
                </form>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Escribes como <b>@{lead[1]}</b>. Lo que el asistente apunta se guarda de verdad en tu app.</p>
      </div>

      {/* What happens in the CRM, live */}
      <aside className="w-full max-w-[380px] xl:w-[300px]" aria-label="En tu CRM">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: BRAND.red }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: BRAND.red }} /></span>
            <h3 className="font-semibold">En tu CRM</h3>
          </div>
          {disabled ? <p className="mt-3 text-sm text-muted-foreground">{disabled}</p> : !conv ? (
            <p className="mt-3 text-sm text-muted-foreground">Comenta «{keyword}», responde a la historia o escribe por privado. Aquí verás cómo se rellena tu CRM mientras habla.</p>
          ) : (
            <div className="mt-3 rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2.5">
                <Avatar text={lead[0]} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{String(contact?.data.nombre ?? lead[0])}</div>
                  <div className="truncate text-xs text-muted-foreground">@{lead[1]}</div>
                </div>
                {estado && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={chipStyle(estado.color, false)}>{estado.label}</span>}
              </div>
              {typeof conv.data.puntuacion === 'number' && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs"><span className="text-muted-foreground">Puntuación</span><span className="font-semibold tabular-nums">{conv.data.puntuacion}/100 {temp && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={chipStyle(temp.color, false)}>{temp.label}</span>}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${conv.data.puntuacion}%`, background: `linear-gradient(90deg, ${BRAND.from}, ${BRAND.to})` }} /></div>
                </div>
              )}
              {typeof conv.data.resumen === 'string' && conv.data.resumen && <p className="mt-2 text-xs text-muted-foreground">{conv.data.resumen}</p>}
            </div>
          )}
          <ol className="mt-3 flex flex-col gap-2">
            {feed.map((f) => {
              const { icon: Icon, color } = feedIcon(f.text);
              return (
                <li key={f.id} className="flex items-start gap-2.5 text-sm" style={{ animation: 'fadeIn .3s ease' }}>
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `${color}18`, color }}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1 leading-snug">{f.text}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{f.time}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
