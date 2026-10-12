import type { ReactNode } from 'react';
import { CalendarDays, CalendarRange, Command, Filter, Home, LayoutDashboard, Moon, TrendingUp } from 'lucide-react';
import { Reveal, SectionHead } from './Backdrop';
import { AgendaMock, CalendarMock, CommandMock, DarkModeMock, FiltersMock, OpsMock, PropertiesMock, SalesMock } from './Mockups';

// The bento of features: each tile says one thing in words and shows it.

function Tile({ icon: Icon, kicker, title, text, children, className = '', delay = 0, side = false }: {
  icon: typeof Home; kicker: string; title: string; text: string; children: ReactNode; className?: string; delay?: number; side?: boolean;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <figure className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-estate-line bg-white p-5 shadow-[0_1px_2px_rgba(19,42,30,.04)] transform-gpu transition-all duration-500 hover:-translate-y-2 hover:rotate-[.3deg] hover:border-estate-sage hover:shadow-[0_42px_75px_-34px_rgba(19,42,30,.42)] motion-reduce:transform-none sm:p-6 ${side ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)] lg:items-center lg:gap-8' : ''}`}>
        <figcaption className="relative">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-estate-moss">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-estate-forest text-estate-lime"><Icon className="h-3.5 w-3.5" /></span>{kicker}
          </span>
          <h3 className="mt-3 text-balance font-serif text-2xl font-normal tracking-[-0.01em] text-estate-ink sm:text-[1.7rem]">{title}</h3>
          <p className="mt-2 text-pretty text-sm text-estate-muted sm:text-[15px]">{text}</p>
        </figcaption>
        <div className={`relative mt-5 ${side ? 'lg:mt-0' : 'flex-1'} transition duration-500 group-hover:-translate-y-1`}>{children}</div>
      </figure>
    </Reveal>
  );
}

export function Features() {
  return (
    <section id="funciones" aria-labelledby="funciones-title" className="relative scroll-mt-24 px-4 py-24 sm:py-32">
      <SectionHead id="funciones-title" eyebrow="Funciones" title={<>Todo lo que pasa en tu agencia, <span className="sh-accent">en un sitio</span>.</>}
        text="Pensado para el día a día de una inmobiliaria: lo que entra, lo que se enseña, lo que se vende y lo que se alquila." />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:gap-5 lg:grid-cols-6">
        <Tile className="lg:col-span-4" icon={LayoutDashboard} kicker="Centro de operaciones" title="Abres la app y sabes qué toca hoy"
          text="Llegadas, salidas, limpiezas y visitas del día, con los avisos arriba: solapes, llegadas sin limpieza, cobros pendientes.">
          <OpsMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.08} icon={CalendarDays} kicker="Agenda" title="La semana de un vistazo"
          text="Visitas, llamadas y recordatorios del equipo, con lo que agenda el bot de Instagram.">
          <AgendaMock />
        </Tile>
        <Tile className="lg:col-span-6" side icon={CalendarRange} kicker="Calendario de reservas" title="Una fila por alojamiento, un color por canal"
          text="Las reservas de Airbnb, Booking y las directas en el mismo calendario. Si dos se pisan, la barra se marca en rojo y el aviso sale en Hoy.">
          <CalendarMock />
        </Tile>
        <Tile className="lg:col-span-3" icon={Home} kicker="Fichas de inmuebles" title="Cada inmueble, con sus fotos y lo que importa"
          text="Venta, alquiler o turístico: precio, habitaciones, metros, licencia y ocupación en la misma ficha.">
          <PropertiesMock />
        </Tile>
        <Tile className="lg:col-span-3" delay={0.08} icon={TrendingUp} kicker="Ventas y objetivos" title="Sabes cómo va el trimestre"
          text="Ventas cerradas mes a mes, el objetivo en un donut y qué tipo de inmueble se mueve más.">
          <SalesMock />
        </Tile>
        <Tile className="lg:col-span-2" icon={Filter} kicker="Filtros" title="«Casos cerrados» a un clic"
          text="Filtra como en Notion y guarda la vista: cerradas este mes, perdidas, por agente o por zona.">
          <FiltersMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.08} icon={Command} kicker="Búsqueda ⌘K" title="Encuentra cualquier cosa"
          text="Un piso, un huésped, un propietario o una reserva. Escribe tres letras y ya está.">
          <CommandMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.16} icon={Moon} kicker="Modo oscuro" title="De día y de noche"
          text="Para revisar las llegadas a las once de la noche sin quedarte ciego.">
          <DarkModeMock />
        </Tile>
      </div>
    </section>
  );
}
