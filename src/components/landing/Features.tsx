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
      <SectionHead id="funciones-title" eyebrow="Features" title={<>Everything your agency needs, <span className="sh-accent">in one place</span>.</>}
        text="Built for real estate teams: leads, viewings, sales, rentals and tasks in one connected workspace." />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:gap-5 lg:grid-cols-6">
        <Tile className="lg:col-span-4" icon={LayoutDashboard} kicker="Operations center" title="Know what needs attention today"
          text="Arrivals, departures, cleaning and viewings, with alerts for overlaps and pending tasks.">
          <OpsMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.08} icon={CalendarDays} kicker="Schedule" title="Your week at a glance"
          text="Viewings, calls, reminders and appointments from connected channels.">
          <AgendaMock />
        </Tile>
        <Tile className="lg:col-span-6" side icon={CalendarRange} kicker="Booking calendar" title="One row per property, one color per channel"
          text="See Airbnb, Booking and direct reservations together, with overlap alerts.">
          <CalendarMock />
        </Tile>
        <Tile className="lg:col-span-3" icon={Home} kicker="Property profiles" title="Property photos and the details that matter"
          text="Sales, rentals and short stays: pricing, bedrooms, area and occupancy in one record.">
          <PropertiesMock />
        </Tile>
        <Tile className="lg:col-span-3" delay={0.08} icon={TrendingUp} kicker="Sales and targets" title="Track your quarterly performance"
          text="See closed deals, progress against targets and active property types.">
          <SalesMock />
        </Tile>
        <Tile className="lg:col-span-2" icon={Filter} kicker="Filters" title="Closed deals in one click"
          text="Filter by stage, agent, location or date and save your views.">
          <FiltersMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.08} icon={Command} kicker="Search ⌘K" title="Find anything fast"
          text="Search properties, guests, owners and reservations from one place.">
          <CommandMock />
        </Tile>
        <Tile className="lg:col-span-2" delay={0.16} icon={Moon} kicker="Dark mode" title="Comfortable day or night"
          text="A calmer workspace for late-night operations.">
          <DarkModeMock />
        </Tile>
      </div>
    </section>
  );
}
