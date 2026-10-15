import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, Bath, BedDouble, Bell, CalendarDays, Check, ChevronDown, CornerDownLeft, Filter, Instagram, LogIn, LogOut, Maximize, Moon, Plus, Search, Send, Sparkles, Sun, UserRound } from 'lucide-react';
import { APP, APP_DARK, CHANNEL, E, NUM, SERIF } from './palette';
import type { AppColors } from './palette';

// Pictures of the app for the public web, drawn in JSX so they are sharp,
// light and need no network: cream background, white cards, forest green
// and a lime/sun accent. Decorative: each one sits inside a <figure> whose
// caption says the same in words. Property photos are elegant green
// placeholders until the real ones arrive (pass `src` to <Photo>).

const L = APP;
type Channel = keyof typeof CHANNEL;
const CHIP: Record<string, [string, string]> = {
  lime: ['#eef7cf', '#3d5a12'], forest: [E.forest, '#ffffff'], sun: ['#fbf0c9', '#7a5a07'], red: ['#fde2e2', '#b91c1c'], blue: ['#e3efff', '#1d4ed8'],
  green: ['#dcf2e3', '#1d6b3a'], gray: ['#efede6', '#4f574f'], purple: ['#ece8fb', '#5b3fb5'],
};

export function Chip({ color = 'gray', children, className = '' }: { color?: string; children: ReactNode; className?: string }) {
  const [bg, fg] = CHIP[color] ?? CHIP.gray;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`} style={{ background: bg, color: fg }}>{children}</span>;
}

/** A property photo: the real one when there is `src`, an elegant green placeholder until then. */
export function Photo({ src, alt = '', className = '', children }: { src?: string; alt?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden ${src ? '' : 'sh-photo'} ${className}`}>
      {src ? <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : (
        <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[70%] w-full" aria-hidden>
          <g fill="none" stroke="rgba(244,242,236,.28)" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M40 120V70l38-26 38 26v50" /><path d="M116 120V58h46v62" /><path d="M58 120V92h18v28M90 84h16v14H90zM126 72h12v12h-12zM146 72h10v12h-10zM126 94h12v12h-12z" />
            <path d="M10 120h180" /><path d="M24 120c0-14 4-22 8-22s8 8 8 22" />
          </g>
        </svg>
      )}
      {children}
    </div>
  );
}

/** A piece of app on cream: the surface every mockup sits on. */
export function Paper({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden className={`overflow-hidden rounded-[22px] text-left shadow-[0_24px_60px_-28px_rgba(19,42,30,.35)] ${className}`} style={{ background: L.bg, color: L.text, border: `1px solid ${L.border}`, ...style }}>
      {children}
    </div>
  );
}

const Box = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={`rounded-2xl ${className}`} style={{ background: L.surface, border: `1px solid ${L.border}`, ...style }}>{children}</div>
);
const Muted = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={className} style={{ color: L.muted }}>{children}</span>;
const Title = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={`font-normal ${className}`} style={{ fontFamily: SERIF }}>{children}</span>;

// ---- Centro de operaciones ---------------------------------------------------

type OpsLine = [time: string, who: string, where: string, tag?: [string, string], done?: boolean];
const OPS: { title: string; icon: typeof LogIn; lines: OpsLine[] }[] = [
  { title: 'Llegadas', icon: LogIn, lines: [['16:00', 'Emma Larsen', 'Malvarrosa Sol', ['Airbnb', 'red']], ['19:30', 'Paolo Ricci', 'Loft Carmen', ['Booking', 'blue']]] },
  { title: 'Departures', icon: LogOut, lines: [['10:00', 'Martinez Group', 'Ruzafa penthouse', undefined, true], ['11:00', 'Jonas Weber', 'Estudio Cabanyal']] },
  { title: 'Cleaning', icon: Sparkles, lines: [['11:30', 'Ruzafa penthouse', 'Lucia', undefined, true], ['12:00', 'Estudio Cabanyal', 'Lucia'], ['13:00', 'Malvarrosa Sol', 'Marta']] },
];

export function OpsMock() {
  return (
    <Paper className="p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Title className="block text-xl leading-none sm:text-2xl">Hoy</Title>
          <Muted className="text-[11px]">lunes, 12 de octubre · 5 de 6 alojamientos ocupados</Muted>
        </div>
        <div className="flex gap-1.5"><Chip color="forest">2 llegadas</Chip><Chip color="sun">2 salidas</Chip><Chip color="lime">3 limpiezas</Chip></div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium" style={{ background: CHIP.red[0], color: CHIP.red[1] }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Loft Carmen: dos reservas se solapan el 16 de octubre</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium" style={{ background: CHIP.sun[0], color: CHIP.sun[1] }}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Casa Albufera: arrival tomorrow without assigned cleaning</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPS.map(({ title, icon: Icon, lines }, ci) => (
          <Box key={title} className={`p-2.5 ${ci === 2 ? 'hidden sm:block' : ''}`}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: E.forest, color: E.lime }}><Icon className="h-3 w-3" /></span>
              {title}<Muted className="ml-auto text-[10px] font-normal">{lines.length}</Muted>
            </div>
            {lines.map(([time, who, where, tag, done]) => (
              <div key={who + time} className="flex items-center gap-2 py-1 text-[11px]" style={{ borderTop: `1px solid ${L.border}`, opacity: done ? 0.55 : 1 }}>
                <span className="w-9 shrink-0 font-semibold" style={NUM}>{time}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-medium">{who}</span>
                  <Muted className="block truncate text-[10px]">{where}</Muted>
                </span>
                {done ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: E.moss }} /> : tag && <Chip color={tag[1]}>{tag[0]}</Chip>}
              </div>
            ))}
          </Box>
        ))}
      </div>
    </Paper>
  );
}

// ---- Calendario de reservas ---------------------------------------------------

const DAYS = 14; // 12 → 25 de octubre
type Bar = [from: number, nights: number, guest: string, channel: Channel, lane?: number];
const STAYS: [string, Bar[]][] = [
  ['Malvarrosa Sol', [[0, 3, 'Emma Larsen', 'airbnb'], [4, 5, 'Familia Dubois', 'booking'], [10, 3, 'Iker', 'directa']]],
  ['Loft Carmen', [[0, 2, 'Liam', 'airbnb'], [2, 3, 'Paolo Ricci', 'booking'], [4, 3, 'Sophie Klein', 'airbnb', 1], [9, 4, 'Ana y Luis', 'booking']]],
  ['Ruzafa penthouse', [[1, 6, 'Martinez Group', 'booking'], [8, 5, 'Noah Jensen', 'airbnb']]],
  ['Casa Albufera', [[1, 4, 'Marco', 'directa'], [6, 7, 'The Millers', 'airbnb']]],
  ['Estudio Cabanyal', [[0, 1, 'Jonas', 'booking'], [3, 2, 'Chloé', 'airbnb'], [6, 3, 'Kenji', 'booking'], [11, 3, 'Zoe', 'airbnb']]],
];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function CalendarMock() {
  const pct = (d: number) => `${(d / DAYS) * 100}%`;
  return (
    <Paper className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Title className="text-lg">Reservas · 12–25 de octubre</Title>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {(['airbnb', 'booking', 'directa'] as Channel[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded-full" style={{ background: CHANNEL[c] }} /><Muted>{c === 'airbnb' ? 'Airbnb' : c === 'booking' ? 'Booking' : 'Directa'}</Muted></span>
          ))}
          <Chip color="red"><AlertTriangle className="h-3 w-3" /> 1 solape</Chip>
        </div>
      </div>
      <div className="mt-3 flex text-[9px] sm:text-[10px]">
        <span className="w-[74px] shrink-0 sm:w-32" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
          {Array.from({ length: DAYS }, (_, i) => (
            <div key={i} className="mx-auto w-full max-w-[26px] rounded-full py-0.5 text-center leading-tight" style={i === 0 ? { background: E.forest, color: '#fff', fontWeight: 700 } : { color: L.muted, fontWeight: 500 }}>
              <div className="hidden sm:block">{DOW[i % 7]}</div>
              <div style={NUM}>{12 + i}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {STAYS.map(([name, bars]) => {
          const clash = bars.some((b) => b[4]);
          return (
            <div key={name} className="flex items-stretch">
              <span className="flex w-[74px] shrink-0 flex-col justify-center pr-2 text-[10px] font-medium leading-tight sm:w-32 sm:text-[11px]">
                <span className="truncate">{name}</span>
                {clash && <span className="flex items-center gap-0.5 text-[9px]" style={{ color: CHIP.red[1] }}><AlertTriangle className="h-2.5 w-2.5" />Se solapan</span>}
              </span>
              <div className="relative flex-1 overflow-hidden rounded-lg" style={{ height: clash ? 44 : 24, background: L.surface, border: `1px solid ${L.border}` }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
                  {Array.from({ length: DAYS }, (_, i) => <span key={i} style={{ borderLeft: i ? `1px solid ${L.border}` : undefined, background: i % 7 === 5 || i % 7 === 6 ? 'rgba(30,58,43,.03)' : undefined }} />)}
                </div>
                {clash && <span className="absolute inset-y-0" style={{ left: pct(4.5), width: pct(1), background: 'repeating-linear-gradient(45deg, rgba(220,38,38,.22) 0 4px, rgba(220,38,38,.05) 4px 8px)' }} />}
                {bars.map(([from, nights, guest, channel, lane]) => {
                  const hit = clash && (lane || (from <= 4 && from + nights > 4.5 && channel === 'booking'));
                  return (
                    <span key={guest} className={`absolute flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 text-[9px] font-semibold text-white sm:text-[10px] ${hit ? 'sh-pulse' : ''}`}
                      style={{ left: `calc(${pct(from + 0.5)} + 1px)`, width: `calc(${pct(nights)} - 2px)`, top: lane ? 23 : 3, height: 18, background: CHANNEL[channel], outline: hit ? '2px solid #b91c1c' : undefined, outlineOffset: 1 }}>
                      {hit && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}<span className="truncate">{guest}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Paper>
  );
}

// ---- Fichas de inmuebles ------------------------------------------------------

const HOMES: { title: string; zone: string; price: string; tag: [string, string]; facts: [number, number, number] }[] = [
  { title: 'Penthouse with terrace', zone: 'Ruzafa, Valencia', price: '330.000 €', tag: ['For sale', 'lime'], facts: [3, 2, 110] },
  { title: 'Malvarrosa Sol', zone: 'Playa de la Malvarrosa', price: '128 € / night', tag: ['Holiday rental', 'sun'], facts: [2, 1, 64] },
  { title: 'Casa con piscina', zone: 'Godella', price: '435.000 €', tag: ['Reservada', 'gray'], facts: [5, 3, 260] },
];

export function PropertiesMock() {
  return (
    <Paper className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between"><Title className="text-lg">Properties</Title><Muted className="text-[11px]">48 en cartera</Muted></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {HOMES.map((h, i) => (
          <Box key={h.title} className={`overflow-hidden p-1.5 ${i === 2 ? 'hidden sm:block' : ''}`}>
            <Photo className="aspect-[4/3] rounded-xl">
              <span className="absolute left-1.5 top-1.5"><Chip color={h.tag[1]}>{h.tag[0]}</Chip></span>
            </Photo>
            <div className="px-1 pb-1 pt-2">
              <div className="truncate text-[12px] font-semibold">{h.title}</div>
              <Muted className="block truncate text-[10px]">{h.zone}</Muted>
              <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: L.muted }}>
                <span className="inline-flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{h.facts[0]}</span>
                <span className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" />{h.facts[1]}</span>
                <span className="inline-flex items-center gap-0.5"><Maximize className="h-3 w-3" />{h.facts[2]} m²</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="truncate text-[13px] font-bold" style={NUM}>{h.price}</span>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: E.forest }}>Ver ficha<ArrowUpRight className="h-3 w-3" /></span>
              </div>
            </div>
          </Box>
        ))}
      </div>
    </Paper>
  );
}

// ---- Ventas: gráfico de área y objetivos ---------------------------------------

const SALES = [18, 22, 19, 27, 25, 31, 29, 36, 34, 41, 39, 46];
const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function AreaChart({ className = '', height = 110 }: { className?: string; height?: number }) {
  const w = 300; const h = 100; const max = 50;
  const pts = SALES.map((v, i) => [(i / (SALES.length - 1)) * w, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className={className} style={{ height }} preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="sh-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={E.moss} stopOpacity=".35" /><stop offset="1" stopColor={E.moss} stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke={L.border} strokeDasharray="3 4" />)}
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#sh-area)" />
      <path d={line} fill="none" stroke={E.forest} strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[9][0]} cy={pts[9][1]} r="4" fill={E.lime} stroke={E.forest} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {MONTHS.map((m, i) => <text key={i} x={(i / 11) * w} y={h + 12} fontSize="8" fill={L.muted} textAnchor={i === 0 ? 'start' : i === 11 ? 'end' : 'middle'}>{m}</text>)}
    </svg>
  );
}

export function Donut({ value = 85, size = 104, label = 'del objetivo' }: { value?: number; size?: number; label?: string }) {
  const r = 40; const c = 2 * Math.PI * r;
  const a = (value / 100) * c * 0.72; const b = (value / 100) * c - a;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke={E.sand} strokeWidth="11" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={E.forest} strokeWidth="11" strokeDasharray={`${a} ${c}`} transform="rotate(-90 50 50)" strokeLinecap="round" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={E.sun} strokeWidth="11" strokeDasharray={`${b} ${c}`} strokeDashoffset={-a - 3} transform="rotate(-90 50 50)" strokeLinecap="round" />
      <text x="50" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill={L.text} style={NUM}>{value} %</text>
      <text x="50" y="66" textAnchor="middle" fontSize="7.5" fill={L.muted}>{label}</text>
    </svg>
  );
}

export function SalesMock() {
  return (
    <Paper className="p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <Box className="p-3">
          <div className="flex items-center justify-between"><span className="text-[12px] font-semibold">Ventas cerradas</span><Chip color="lime">+18 % vs. 2025</Chip></div>
          <div className="mt-1 text-2xl font-bold" style={NUM}>1,48 M€</div>
          <AreaChart className="mt-1 w-full" />
        </Box>
        <Box className="flex flex-col items-center justify-center p-3">
          <span className="self-start text-[12px] font-semibold">Objetivo del trimestre</span>
          <Donut />
          <div className="flex gap-3 text-[10px]"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: E.forest }} />Ventas</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: E.sun }} />Alquiler</span></div>
        </Box>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {([['Apartments', 62], ['Penthouses', 44], ['Houses', 31], ['Holiday rentals', 23]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 shrink-0 font-medium">{k}</span>
            <span className="relative h-2.5 flex-1 rounded-full" style={{ background: E.sand }}><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: k === 'Holiday rentals' ? E.sun : E.forest }} /></span>
            <span className="w-9 text-right font-semibold" style={NUM}>{v} %</span>
          </div>
        ))}
      </div>
    </Paper>
  );
}

// ---- Filtros tipo Notion -------------------------------------------------------

const CLOSED: [string, string, string, string][] = [
  ['Apartment in Benimaclet', 'Marta', 'Oct 3', '215.000 €'], ['Plaza Redonda penthouse', 'Alex', 'Sep 27', '330.000 €'],
  ['Alquiler Calle Sueca', 'Marta', '22 sept', '1.050 €/mes'], ['Casa en Rocafort', 'Nuria', '15 sept', '398.000 €'],
];

export function FiltersMock() {
  return (
    <Paper className="p-3 sm:p-4">
      <div className="inline-flex gap-1 rounded-full p-1 text-[11px]" style={{ background: L.surface, border: `1px solid ${L.border}` }}>
        {['Todas', 'Casos cerrados', 'Perdidas'].map((t, i) => (
          <span key={t} className="rounded-full px-2.5 py-1 font-medium" style={i === 1 ? { background: E.forest, color: '#fff' } : { color: L.muted }}>{t}</span>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
        <Filter className="h-3 w-3" style={{ color: L.muted }} />
        {[['Stage', 'es', 'Closed'], ['Closing', 'en', 'the last 30 days']].map(([a, b, c]) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: CHIP.lime[0], color: CHIP.lime[1] }}>
            <b className="font-semibold">{a}</b> {b} <b className="font-semibold">{c}</b><ChevronDown className="h-2.5 w-2.5" />
          </span>
        ))}
        <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5" style={{ border: `1px dashed ${L.border}`, color: L.muted }}><Plus className="h-2.5 w-2.5" />Filtro</span>
      </div>
      <Box className="mt-2.5 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1.5 text-[10px] font-medium sm:grid-cols-[1fr_4rem_3.5rem_auto]" style={{ color: L.muted, background: L.bg }}>
          <span>Deal</span><span className="hidden sm:block">Agent</span><span>Closing</span><span className="text-right">Amount</span>
        </div>
        {CLOSED.map(([what, who, when, money]) => (
          <div key={what} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-2.5 py-1.5 text-[11px] sm:grid-cols-[1fr_4rem_3.5rem_auto]" style={{ borderTop: `1px solid ${L.border}` }}>
            <span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: E.moss }} /><span className="truncate font-medium">{what}</span></span>
            <span className="hidden items-center gap-1 sm:flex"><UserRound className="h-3 w-3" style={{ color: L.muted }} />{who}</span>
            <Muted>{when}</Muted>
            <span className="text-right font-semibold" style={NUM}>{money}</span>
          </div>
        ))}
        <div className="flex justify-between px-2.5 py-1.5 text-[10px] font-medium" style={{ borderTop: `1px solid ${L.border}`, color: L.muted }}><span>4 casos</span><span>Guardada como vista</span></div>
      </Box>
    </Paper>
  );
}

// ---- Búsqueda ⌘K ----------------------------------------------------------------

const HITS: [string, [string, string][]][] = [
  ['Properties', [['Malva', 'rrosa Sol · holiday apartment']]],
  ['Reservas', [['', 'Emma Larsen · '], ['Malva', 'rrosa Sol · 12–15 oct']]],
  ['Contacts', [['', 'Sofia Llorens · owner of '], ['Malva', 'rrosa Sol']]],
];

export function CommandMock() {
  return (
    <Paper className="p-2.5" style={{ background: L.surface }}>
      <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px]" style={{ background: L.bg }}>
        <Search className="h-4 w-4" style={{ color: L.muted }} />
        <span className="font-medium">malva<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-current motion-reduce:animate-none" /></span>
        <span className="ml-auto rounded px-1.5 text-[10px] font-semibold" style={{ border: `1px solid ${L.border}`, color: L.muted }}>⌘K</span>
      </div>
      {HITS.map(([group, parts], gi) => (
        <div key={group} className="mt-1.5">
          <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: L.muted }}>{group}</div>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]" style={gi === 0 ? { background: CHIP.lime[0] } : undefined}>
            <span className="min-w-0 truncate">{parts.map(([hit, rest], i) => <span key={i}>{hit && <b className="font-bold" style={{ color: E.forest }}>{hit}</b>}{rest}</span>)}</span>
            {gi === 0 && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: L.muted }} />}
          </div>
        </div>
      ))}
      <div className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]" style={{ borderTop: `1px solid ${L.border}` }}>
        <Plus className="h-3.5 w-3.5" style={{ color: E.forest }} /> Nueva reserva en Malvarrosa Sol
      </div>
    </Paper>
  );
}

// ---- Modo oscuro ------------------------------------------------------------------

function MiniBoard({ c }: { c: AppColors }) {
  const dark = c === APP_DARK;
  return (
    <div className="absolute inset-0 p-3" style={{ background: c.bg, color: c.text }}>
      <div className="flex w-fit items-center gap-1 rounded-full p-1 text-[10px]" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
        {['Hoy', 'Reservas', 'Properties'].map((t, i) => <span key={t} className="rounded-full px-2 py-0.5" style={i === 0 ? { background: dark ? E.lime : E.forest, color: dark ? E.deep : '#fff' } : { color: c.muted }}>{t}</span>)}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {[['Occupancy', '82 %'], ['Net this month', '6.840 €']].map(([k, v]) => (
          <div key={k} className="rounded-xl p-2" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <div className="text-[9px]" style={{ color: c.muted }}>{k}</div><div className="text-[15px] font-bold" style={NUM}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {[['16:00', 'Llegada · Emma'], ['18:00', 'Viewing · Clara Vidal'], ['19:30', 'Llegada · Paolo']].map(([h, t]) => (
          <div key={h} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[10px]" style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <span className="font-semibold" style={NUM}>{h}</span><span className="h-3 w-[3px] rounded-full" style={{ background: dark ? E.lime : E.moss }} />{t}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DarkModeMock() {
  return (
    <div aria-hidden className="relative h-[210px] overflow-hidden rounded-[22px] shadow-[0_24px_60px_-28px_rgba(19,42,30,.45)]" style={{ border: `1px solid ${L.border}` }}>
      <MiniBoard c={APP} />
      <div className="absolute inset-0" style={{ clipPath: 'polygon(62% 0, 100% 0, 100% 100%, 38% 100%)' }}><MiniBoard c={APP_DARK} /></div>
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full p-1" style={{ background: APP_DARK.surface, border: `1px solid ${APP_DARK.border}` }}>
        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ color: APP_DARK.muted }}><Sun className="h-3.5 w-3.5" /></span>
        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: E.lime, color: E.deep }}><Moon className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}

// ---- Agenda con tira de semana y recordatorios --------------------------------

export function AgendaMock() {
  const week: [string, number][] = [['L', 12], ['M', 13], ['X', 14], ['J', 15], ['V', 16], ['S', 17], ['D', 18]];
  return (
    <Paper className="p-3">
      <div className="flex items-center justify-between"><Title className="text-lg">Agenda</Title><Muted className="text-[11px]">octubre</Muted></div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px]">
        {week.map(([d, n], i) => (
          <span key={n} className="rounded-xl py-1" style={i === 3 ? { background: E.forest, color: '#fff' } : { background: L.surface, border: `1px solid ${L.border}` }}>
            <span className="block" style={{ opacity: 0.7 }}>{d}</span><b className="text-[12px]" style={NUM}>{n}</b>
            {(i === 1 || i === 3 || i === 4) && <i className="mx-auto mt-0.5 block h-1 w-1 rounded-full" style={{ background: i === 3 ? E.lime : E.moss }} />}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 text-[11px]">
        {([['18:00', 'Viewing · Ruzafa penthouse', 'Clara Vidal · from Instagram', CalendarDays], ['Tomorrow', 'Call Pilar Navarro', 'Apartment valuation en Benimaclet', Bell]] as const).map(([h, t, s, Icon]) => (
          <Box key={t} className="flex items-center gap-2 p-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: CHIP.lime[0], color: E.forest }}><Icon className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1 leading-tight"><b className="block truncate font-semibold">{t}</b><Muted className="block truncate text-[10px]">{s}</Muted></span>
            <span className="text-[10px] font-semibold" style={NUM}>{h}</span>
          </Box>
        ))}
      </div>
    </Paper>
  );
}

// ---- Bot de Instagram: cualifica y agenda ------------------------------------------

type Msg = [from: 'them' | 'bot', text: ReactNode];
const CHAT: Msg[] = [
  ['them', 'Hi! Is the Ruzafa penthouse still available?'],
  ['bot', 'Yes, it is available. Are you looking to live there or invest?'],
  ['them', 'To live in. Tenemos la hipoteca preaprobada'],
  ['bot', 'Great. Would Thursday at 6 PM or Friday at 10 AM work for a viewing?'],
  ['them', 'Thursday at 6 PM is perfect!'],
];

export function InstagramMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[340px]">
      <div className="overflow-hidden rounded-[34px] border-[6px] bg-white text-left shadow-[0_40px_80px_-30px_rgba(19,42,30,.55)]" style={{ borderColor: E.ink }}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-4 text-[12px]" style={{ borderBottom: `1px solid ${E.line}` }}>
          <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b 55%, #6228d7)' }}><Instagram className="h-4 w-4" /></span>
          <span className="leading-tight"><b className="block font-semibold" style={{ color: E.ink }}>inmo.mediterraneo</b><span className="text-[10px]" style={{ color: E.muted }}>Responde el asistente · 02:14</span></span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-3 text-[12px]" style={{ background: '#fbfaf7' }}>
          {CHAT.map(([who, text], i) => (
            <span key={i} className={`max-w-[82%] rounded-2xl px-3 py-1.5 leading-snug ${who === 'them' ? 'self-end rounded-br-md text-white' : 'self-start rounded-bl-md'}`}
              style={who === 'them' ? { background: '#3b82f6' } : { background: E.sand, color: E.ink }}>{text}</span>
          ))}
          <span className="mt-1 self-center rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: CHIP.lime[0], color: CHIP.lime[1] }}>
            <Check className="mr-0.5 inline h-3 w-3" />Visita agendada · jue 15, 18:00
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 text-[11px]" style={{ borderTop: `1px solid ${E.line}`, color: E.muted }}>
          <span className="flex-1 rounded-full px-3 py-1.5" style={{ background: E.cream }}>Mensaje…</span><Send className="h-4 w-4" />
        </div>
      </div>
      {/* The lead it leaves in the CRM */}
      <div className="absolute -bottom-20 -right-2 w-[230px] rounded-2xl bg-white p-3 text-left text-[11px] shadow-[0_24px_50px_-20px_rgba(19,42,30,.5)] sm:-right-16" style={{ border: `1px solid ${E.line}`, color: E.ink }}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold" style={{ background: E.forest, color: E.lime }}>CV</span>
          <span className="leading-tight"><b className="block text-[12px]">Clara Vidal</b><span style={{ color: E.muted }}>Nuevo lead · Instagram</span></span>
          <Chip color="red" className="ml-auto">Caliente</Chip>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]" style={{ color: E.muted }}>
          <span>To live in</span><span>Mortgage pre-approved</span><span>Ruzafa penthouse</span><span className="font-semibold" style={{ color: E.forest }}>Viewing Thu 6 PM</span>
        </div>
      </div>
    </div>
  );
}
