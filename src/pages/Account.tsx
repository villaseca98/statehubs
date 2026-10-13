import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Copy, LogOut, Plus, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { hasServer, supabase } from '@/lib/supabase';
import { crmApi } from '@/lib/crm/api';
import type { CrmApp, CrmOrganization, CrmOrgMember, OrgRole, PlatformOrganization } from '@/lib/crm/api';
import { composePack } from '@shared/blueprint/modules';
import { useProductText } from '@/i18n/product';
import { LanguageSelector } from '@/components/brand/LanguageSelector';
import { Logo } from '@/components/brand/Logo';
import { SHButton } from '@/design';

export default function Account() {
  const text = useProductText();
  const { user, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<CrmApp[]>([]);
  const [organizations, setOrganizations] = useState<CrmOrganization[]>([]);
  const [platformOrganizations, setPlatformOrganizations] = useState<PlatformOrganization[]>([]);
  const [platform, setPlatform] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<CrmOrganization | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const isPlatform = await crmApi.platformStatus();
      const [workspaces, orgs, global] = await Promise.all([crmApi.listApps(), crmApi.organizations(), isPlatform ? crmApi.platformOrganizations() : Promise.resolve([])]);
      setPlatform(isPlatform); setApps(workspaces); setOrganizations(orgs); setPlatformOrganizations(global);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load account'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (authLoading || authError) return;
    if (hasServer && !user) { navigate('/login?next=/workspace', { replace: true }); return; }
    if (user) void load(); else setLoading(false);
  }, [user, authLoading, authError, load, navigate]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const app = await crmApi.createApp(user.id);
      const { proposal } = await crmApi.propose(app.id, composePack('ambos', name.trim()));
      await crmApi.apply(proposal.id);
      navigate(`/app/${app.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : text.error); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    try {
      const { error: failure } = await supabase!.auth.signOut();
      if (failure) throw failure;
      navigate('/login');
    } catch (e) { setError(e instanceof Error ? e.message : text.error); }
  };

  return <main className="min-h-screen bg-[#f8f8fa] text-estate-ink">
    <header className="border-b bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><Link to="/"><Logo size={34} /></Link><div className="flex items-center gap-3"><LanguageSelector />{user && <button onClick={signOut} className="flex min-h-11 items-center gap-2 text-sm text-estate-muted"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{text.signOut}</span></button>}</div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-estate-forest">StateHubs / {text.account}</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{text.workspaces}</h1><p className="mt-3 text-estate-muted">{text.accountIntro}</p></div>{platform && <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-estate-forest"><ShieldCheck className="h-4 w-4" />{text.platformAdmin}</span>}</div>
      {(error || authError) && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || text.sessionError}<button onClick={() => authError ? window.location.reload() : void load()} className="ml-4 font-semibold underline">{text.retry}</button></div>}
      {!hasServer ? <section className="rounded-2xl border bg-white p-8"><p>{text.accessUnavailable}</p><Link to="/demo" className="mt-4 inline-flex items-center gap-2 font-semibold text-estate-forest">{text.exploreDemo}<ArrowRight className="h-4 w-4" /></Link></section>
        : authLoading || loading ? <p role="status">{text.loading}</p> : user && <>
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-5 py-4"><span className="min-w-0 flex-1 truncate text-sm font-medium">{user.email}</span><button onClick={async () => { try { await navigator.clipboard.writeText(user.id); setCopied(true); } catch { setError(text.error); } }} className="flex min-h-11 items-center gap-2 text-xs font-semibold text-estate-muted"><Copy className="h-4 w-4" />{copied ? text.copied : text.copyId}</button></div>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label={text.workspaces}>
            {apps.map(app => <Link key={app.id} to={`/app/${app.id}`} className="group rounded-2xl border bg-white p-6 transition hover:border-rose-200 hover:shadow-md"><div className="mb-7 flex items-center justify-between"><span className="rounded-xl bg-rose-50 p-3 text-estate-forest"><Building2 className="h-6 w-6" /></span><ArrowRight className="h-5 w-5 text-estate-muted transition group-hover:translate-x-1" /></div><h2 className="text-lg font-semibold">{app.name}</h2><p className="mt-3 text-sm text-estate-muted">{text.openWorkspace}</p></Link>)}
            <form onSubmit={create} className="rounded-2xl border border-dashed border-rose-300 bg-white p-6"><Plus className="mb-5 h-6 w-6 text-estate-forest" /><label className="block text-sm font-semibold" htmlFor="agency-name">{text.workspaceName}</label><input id="agency-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={text.agencyPlaceholder} className="mt-3 w-full rounded-xl border bg-white px-3 py-3 text-sm" /><SHButton type="submit" loading={busy} className="mt-4 w-full">{text.createWorkspace}</SHButton></form>
          </section>
          {!apps.length && <p className="mt-5 text-sm text-estate-muted">{text.emptyWorkspaces}</p>}
          {!!organizations.length && <section className="mt-12"><h2 className="text-xl font-semibold">{text.yourTeam}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{organizations.map(org => <button key={org.id} onClick={() => setSelected(org)} className="flex items-center gap-3 rounded-xl border bg-white p-5 text-left"><Users className="h-5 w-5 text-estate-forest" /><span className="min-w-0 flex-1 truncate font-medium">{org.name}</span><ArrowRight className="h-4 w-4" /></button>)}</div></section>}
          {platform && <section className="mt-12 rounded-2xl border bg-white p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5 text-estate-forest" />{text.administration}</h2><p className="mt-2 text-sm text-estate-muted">{text.platformIntro}</p><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-estate-muted"><th className="pb-3">{text.organizations}</th><th>{text.members}</th><th>{text.apps}</th><th><span className="sr-only">{text.manage}</span></th></tr></thead><tbody>{platformOrganizations.map(org => <tr key={org.id} className="border-b last:border-0"><td className="py-4 font-medium">{org.name}</td><td>{org.member_count}</td><td>{org.app_count}</td><td><button onClick={() => setSelected(org)} className="min-h-11 px-3 font-semibold text-estate-forest">{text.manage}</button></td></tr>)}</tbody></table></div>{!platformOrganizations.length && <p className="py-5 text-sm text-estate-muted">{text.noOrganizations}</p>}</section>}
          {selected && <TeamPanel key={selected.id} organization={selected} userId={user.id} platform={platform} onClose={() => setSelected(null)} />}
        </>}
    </div>
  </main>;
}

function TeamPanel({ organization, userId, platform, onClose }: { organization: CrmOrganization; userId: string; platform: boolean; onClose: () => void }) {
  const text = useProductText();
  const [members, setMembers] = useState<CrmOrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<Exclude<OrgRole, 'owner'>>('agent');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const rows = await crmApi.members(organization.id); setMembers(rows); }, [organization.id]);
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [load]);
  const canManage = platform || members.some(m => m.user_id === userId && ['owner', 'admin'].includes(m.role));
  const mutate = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await operation(); await load(); setTarget(''); } catch (e) { setError(e instanceof Error ? e.message : text.error); } finally { setBusy(false); }
  };
  return <section className="mt-8 rounded-2xl border border-rose-200 bg-white p-6" aria-label={text.yourTeam}>
    <header className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{organization.name} · {text.yourTeam}</h2><button onClick={onClose} className="min-h-11 px-3 text-sm text-estate-muted">{text.close}</button></header>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="py-5">{text.loading}</p> : <ul className="my-5 divide-y">{members.map(member => <li key={member.user_id} className="flex flex-wrap items-center gap-3 py-3"><code className="min-w-0 flex-1 break-all text-xs">{member.user_id}</code><span className="rounded-full bg-estate-sand px-3 py-1 text-xs">{text[member.role]}</span>{canManage && member.role !== 'owner' && <button disabled={busy} onClick={() => { if (window.confirm(text.confirmRemove)) void mutate(() => crmApi.removeOrganizationMember(organization.id, member.user_id)); }} className="min-h-11 px-2 text-xs font-semibold text-estate-forest">{text.removeMember}</button>}</li>)}</ul>}
    {canManage && <form onSubmit={e => { e.preventDefault(); void mutate(() => crmApi.setOrganizationMember(organization.id, target.trim(), role)); }}><p className="mb-4 text-sm text-estate-muted">{text.memberHelp}</p><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-[2] text-sm font-medium">{text.memberId}<input required pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}" value={target} onChange={e => setTarget(e.target.value)} className="mt-2 block w-full rounded-xl border px-3 py-3 font-mono text-sm" /></label><label className="flex-1 text-sm font-medium">{text.role}<select value={role} onChange={e => setRole(e.target.value as Exclude<OrgRole, 'owner'>)} className="mt-2 block w-full rounded-xl border bg-white px-3 py-3">{(['admin', 'agent', 'viewer'] as const).map(r => <option key={r} value={r}>{text[r]}</option>)}</select></label><SHButton type="submit" loading={busy}>{text.addMember}</SHButton></div></form>}
  </section>;
}
