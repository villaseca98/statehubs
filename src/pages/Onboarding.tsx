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
      try{localStorage.setItem('statehubs:onboarding:'+app.id,JSON.stringify({mode,preferences}));}catch{/* private browsing */}
      navigate('/app/'+app.id,{replace:true});
    }catch(e){setError(e instanceof Error?e.message:'Could not create your workspace. Please retry.');setBusy(false);}
  };
  if(loading||!user)return <main className="grid min-h-screen place-items-center bg-[#f8f8fa]"><Loader2 className="h-8 w-8 animate-spin" aria-label="Loading account"/></main>;
  return <main className="min-h-screen bg-[#f8f8fa] px-4 py-12 text-estate-ink">
    <div className="mx-auto max-w-3xl"><Link to="/" className="text-sm font-semibold text-estate-forest">← StateHubs</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-estate-forest">Workspace setup · Step 1 of 1</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Make StateHubs yours.</h1>
      <p className="mt-4 max-w-xl text-estate-muted">Choose your business and the tools you want to see first. You can change your preferences later.</p>
      <form onSubmit={create} className="mt-9 space-y-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
        <div><label htmlFor="workspace-name" className="block text-sm font-semibold">Agency or workspace name</label>
          <input id="workspace-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={80} placeholder="e.g. Atlantic Property Group" className="mt-2 min-h-12 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-estate-forest"/>
        </div>
        <fieldset><legend className="mb-3 text-sm font-semibold">Your business</legend><div className="grid gap-3 sm:grid-cols-3">
          {modes.map(item=><button type="button" key={item.id} onClick={()=>choose(item.id)} aria-pressed={mode===item.id} className={'min-h-32 rounded-2xl border p-4 text-left transition hover:shadow-md '+(mode===item.id?'border-estate-forest bg-estate-sand':'border-estate-line')}>
            {item.id==='turistico'?<CalendarDays className="mb-3 h-5 w-5"/>:<Building2 className="mb-3 h-5 w-5"/>}
            <span className="block font-semibold">{item.title}</span><span className="mt-2 block text-xs text-estate-muted">{item.subtitle}</span>
          </button>)}
        </div></fieldset>
        <fieldset><legend className="mb-3 text-sm font-semibold">What matters most to your team?</legend><div className="grid gap-3 sm:grid-cols-2">
          {options.map(item=><label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-estate-line p-3 text-sm">
            <input type="checkbox" checked={preferences.includes(item.id)} onChange={e=>setPreferences(prev=>e.target.checked?[...prev,item.id]:prev.filter(x=>x!==item.id))} className="h-4 w-4 accent-estate-forest"/>{item.label}
            {preferences.includes(item.id)&&<Check className="ml-auto h-4 w-4 text-estate-forest"/>}
          </label>)}
        </div></fieldset>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy||!name.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-estate-forest px-5 font-semibold text-white disabled:opacity-50">
          {busy?<Loader2 className="h-5 w-5 animate-spin"/>:<>Create my CRM <ArrowRight className="h-5 w-5"/></>}
        </button>
        <p className="text-xs text-estate-muted">Your CRM is saved to your signed-in account. Display preferences are stored in this browser for now.</p>
      </form>
    </div>
  </main>;
}
