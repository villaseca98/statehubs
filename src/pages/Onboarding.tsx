import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { crmApi } from '@/lib/crm/api';
import { composePack } from '@shared/blueprint/modules.ts';
import type { PackKey } from '@shared/blueprint/modules.ts';

const modes: { id: PackKey; title: string; subtitle: string }[] = [
  { id: 'compraventa', title: 'Real Estate', subtitle: 'Sales, leads, listings and long-term rentals' },
  { id: 'turistico', title: 'Holiday Rentals', subtitle: 'Guests, bookings, occupancy and property operations' },
  { id: 'ambos', title: 'Both', subtitle: 'One workspace for sales and short stays' },
];
const options = [
  { id: 'leads', label: 'Lead capture and qualification' },
  { id: 'matching', label: 'Property and buyer matching' },
  { id: 'sales', label: 'Sales pipeline and viewings' },
  { id: 'bookings', label: 'Reservations and availability' },
  { id: 'operations', label: 'Cleaning and maintenance operations' },
  { id: 'reports', label: 'Portfolio and performance reporting' },
] as const;
type Preference = typeof options[number]['id'];
const defaults: Record<PackKey, Preference[]> = {
  compraventa: ['leads','matching','sales'],
  turistico: ['bookings','operations','reports'],
  ambos: ['leads','matching','sales','bookings','operations','reports'],
};
function initialMode(raw: string | null): PackKey {
  return raw === 'holidays' || raw === 'turistico' ? 'turistico' : raw === 'both' || raw === 'ambos' ? 'ambos' : 'compraventa';
}
export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode,setMode] = useState<PackKey>(()=>initialMode(params.get('mode')));
  const [preferences,setPreferences] = useState<Preference[]>(()=>defaults[initialMode(params.get('mode'))]);
  const [name,setName] = useState('');
  const [busy,setBusy] = useState(false);
  const [step,setStep] = useState(1);
  const [teamSize,setTeamSize] = useState<'solo'|'small'|'large'>('solo');
  const [error,setError] = useState('');
  useEffect(()=>{document.title='Set up your workspace · StateHubs';},[]);
  useEffect(()=>{
    if(!loading&&!user)navigate('/register?next='+encodeURIComponent('/onboarding?mode='+encodeURIComponent(params.get('mode')||'real-estate')),{replace:true});
  },[loading,user,navigate,params]);
  const choose=(next:PackKey)=>{setMode(next);setPreferences(defaults[next]);};
  const create=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!user||busy||!name.trim())return;
    setBusy(true);setError('');
    try{
      const app=await crmApi.createApp(user.id);
      const {proposal}=await crmApi.propose(app.id,composePack(mode,name.trim()));
      await crmApi.apply(proposal.id);
      // Preferences are a client-side presentation choice, not an authorization control.
      // Do not pretend they are persisted to the agency database.
      try{localStorage.setItem('statehubs:onboarding:'+app.id,JSON.stringify({mode,preferences,teamSize}));}catch{/* private browsing */}
      navigate('/app/'+app.id,{replace:true});
    }catch(e){setError(e instanceof Error?e.message:'Could not create your workspace. Please retry.');setBusy(false);}
  };
  if(loading||!user)return <main className="grid min-h-screen place-items-center bg-[#f8f8fa]"><Loader2 className="h-8 w-8 animate-spin" aria-label="Loading account"/></main>;
  const nextStep=()=>setStep(value=>Math.min(4,value+1));
  const previousStep=()=>setStep(value=>Math.max(1,value-1));
  const stepTitles=['Choose your business','Meet your workspace','Set your priorities','Create your CRM'];
  return <main className="min-h-screen bg-[#f8f8fa] px-4 py-10 text-estate-ink">
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm font-semibold text-estate-forest">← StateHubs</Link>
      <div className="mt-10 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-estate-forest">Getting started · Step {step} of 4</p>
        <p className="text-xs text-estate-muted">{Math.round(step/4*100)}% complete</p>
      </div>
      <nav aria-label="Onboarding progress" className="mt-4 grid grid-cols-4 gap-2">
        {stepTitles.map((title,index)=><div key={title} aria-current={step===index+1?'step':undefined}>
          <div className={'h-2 rounded-full '+(step>=index+1?'bg-estate-forest':'bg-estate-line')}/>
          <p className={'mt-2 text-[10px] leading-tight sm:text-xs '+(step===index+1?'font-semibold text-estate-ink':'text-estate-muted')}>{index+1}. {title}</p>
        </div>)}
      </nav>
      <h1 className="mt-9 text-3xl font-semibold tracking-tight sm:text-5xl">{stepTitles[step-1]}</h1>
      <form onSubmit={e=>{e.preventDefault();if(step<4){nextStep();return;}void create(e);}} className="mt-7 space-y-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
        {step===1&&<section>
          <p className="mb-5 text-sm text-estate-muted">StateHubs is one CRM with focused tools for your business. Choose your starting point; your records remain in the same workspace.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {modes.map(item=><button type="button" key={item.id} onClick={()=>choose(item.id)} aria-pressed={mode===item.id} className={'min-h-36 rounded-2xl border p-4 text-left transition hover:shadow-md '+(mode===item.id?'border-estate-forest bg-estate-sand':'border-estate-line')}>
              {item.id==='turistico'?<CalendarDays className="mb-3 h-5 w-5"/>:<Building2 className="mb-3 h-5 w-5"/>}
              <span className="block font-semibold">{item.title}</span><span className="mt-2 block text-xs text-estate-muted">{item.subtitle}</span>
            </button>)}
          </div>
        </section>}
        {step===2&&<section className="space-y-4">
          <p className="text-sm text-estate-muted">Here's how your team will use StateHubs every day. Each area has a distinct purpose.</p>
          {[
            ['1. Contacts & leads','Keep enquiries, owners, buyers and guests in one searchable place.'],
            ['2. Properties & availability','Maintain listings, prices, property details and booking availability.'],
            ['3. Deals & reservations','Track sales from first enquiry to closing, or manage guest bookings and turnovers.'],
            ['4. Today & reporting','See upcoming work, team assignments and business performance.']
          ].map(([title,description])=><div key={title} className="rounded-2xl border border-estate-line p-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-estate-muted">{description}</p></div>)}
          <p className="rounded-xl bg-estate-sand p-4 text-xs text-estate-muted">Start with your contacts and first property. Matching, automation and reporting become useful as you add real records. Connected channels require separate setup.</p>
        </section>}
        {step===3&&<fieldset>
          <legend className="mb-2 text-sm font-semibold">What should your team focus on first?</legend>
          <p className="mb-5 text-sm text-estate-muted">These choices guide your initial experience. They do not change data permissions or automatically activate integrations.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map(item=><label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-estate-line p-3 text-sm">
              <input type="checkbox" checked={preferences.includes(item.id)} onChange={e=>setPreferences(prev=>e.target.checked?[...prev,item.id]:prev.filter(x=>x!==item.id))} className="h-4 w-4 accent-estate-forest"/>{item.label}
              {preferences.includes(item.id)&&<Check className="ml-auto h-4 w-4 text-estate-forest"/>}
            </label>)}
          </div>
        </fieldset>}
        {step===4&&<section className="space-y-6">
          <div><label htmlFor="workspace-name" className="block text-sm font-semibold">Agency or workspace name</label>
            <input id="workspace-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={80} placeholder="e.g. Atlantic Property Group" className="mt-2 min-h-12 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-estate-forest"/>
          </div>
          <fieldset><legend className="mb-3 text-sm font-semibold">How large is your team?</legend><div className="grid grid-cols-3 gap-2">
            {([['solo','Just me'],['small','2–10 people'],['large','11+ people']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setTeamSize(value)} aria-pressed={teamSize===value} className={'rounded-xl border px-2 py-3 text-sm '+(teamSize===value?'border-estate-forest bg-estate-sand font-semibold':'border-estate-line')}>{label}</button>)}
          </div></fieldset>
          <div className="rounded-2xl bg-estate-sand p-4 text-sm"><p className="font-semibold">Your starting setup</p>
            <p className="mt-2 text-estate-muted">{modes.find(item=>item.id===mode)?.title} · {preferences.length} selected priorities</p>
            <p className="mt-2 text-xs text-estate-muted">Your CRM will be created in your signed-in account. Priorities and team size are saved in this browser only; they are not team invitations or backend configuration.</p>
          </div>
        </section>}
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="flex gap-3">
          {step>1&&<button type="button" onClick={previousStep} disabled={busy} className="min-h-12 rounded-xl border border-estate-line px-5 font-semibold">Back</button>}
          <button type="submit" disabled={busy||(step===4&&!name.trim())} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-estate-forest px-5 font-semibold text-white disabled:opacity-50">
            {busy?<Loader2 className="h-5 w-5 animate-spin"/>:<>{step===4?'Create my CRM':'Continue'} <ArrowRight className="h-5 w-5"/></>}
          </button>
        </div>
      </form>
    </div>
  </main>;
}
