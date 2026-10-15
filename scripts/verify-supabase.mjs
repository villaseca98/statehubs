/** Read-only activation audit. Never prints keys, tokens, users or record contents. */
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN;
let failed = false;
function result(name, ok, detail) {
 console.log(`${ok ? 'PASS' : 'BLOCKED'} ${name}${detail ? `: ${detail}` : ''}`);
 if (!ok) failed = true;
}
async function request(name, destination, options = {}) {
 try {
  const response = await fetch(destination, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) { result(name, false, `HTTP ${response.status}`); return null; }
  return await response.json();
 } catch { result(name, false, 'Request could not complete; check network access and configuration.'); return null; }
}
let base;
try {
 base = new URL(url);
 if (base.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) || base.username || base.password || base.search || base.hash || !['', '/'].includes(base.pathname)) throw new Error();
} catch { result('VITE_SUPABASE_URL', false, 'Set the project HTTPS URL in environment settings.'); process.exit(1); }
if (!key) result('VITE_SUPABASE_PUBLISHABLE_KEY', false, 'Set the public client key in environment settings.');
if (key) {
 let privileged = key.startsWith('sb_secret_');
 try { privileged ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* Publishable keys are not JWTs. */ }
 if (privileged) { result('Public client key', false, 'A private key must never be used in a VITE variable. Replace this binding securely before starting or building the frontend.'); process.exit(1); }
}
if (key) {
 const settings = await request('Auth settings', `${base.origin}/auth/v1/settings`, { headers: { apikey: key } });
 if (settings) result('Auth reachable with public key', true);
 const rest = await request('REST API', `${base.origin}/rest/v1/`, { headers: { apikey: key } });
 if (rest) result('REST API reachable with public key', true);
}
if (!token) result('SUPABASE_ACCESS_TOKEN', false, 'Supply a management access token securely to inspect deployed configuration.');
if (token) {
 const ref = base.hostname.split('.')[0];
 const endpoint = `https://api.supabase.com/v1/projects/${ref}`;
 const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
 const project = await request('Project', endpoint, { headers });
 if (project) result('Project active', project.status === 'ACTIVE_HEALTHY', project.status);
 const auth = await request('Auth configuration', `${endpoint}/config/auth`, { headers });
 if (auth) {
  result('Auth Site URL', auth.site_url === 'https://statehubs.vercel.app', auth.site_url === 'https://statehubs.vercel.app' ? undefined : 'Expected https://statehubs.vercel.app; review before changing an existing application.');
  result('Email signup enabled', auth.external_email_enabled === true && auth.disable_signup !== true);
  result('Email confirmation enabled', auth.mailer_autoconfirm === false);
  // SMTP and Google activation must also be exercised with real sign-in callbacks, not inferred here.
 }
 const functions = await request('Edge functions', `${endpoint}/functions`, { headers });
 if (Array.isArray(functions)) {
  for (const name of ['crm-agent', 'crm-automate', 'crm-ical', 'crm-google', 'crm-instagram', 'instagram-lead-webhook']) {
   result(`Function ${name} deployed`, functions.some(f => f.slug === name && f.status === 'ACTIVE'));
  }
 }
 // Explicit read_only is enforced by the management API. No migrations or mutations are executed.
 const schema = await request('Database schema', `${endpoint}/database/query`, { headers, method: 'POST', body: JSON.stringify({ read_only: true, query: "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'crm_%' order by tablename" }) });
 if (Array.isArray(schema)) {
  for (const name of ['crm_apps', 'crm_records', 'crm_organizations', 'crm_org_members', 'crm_record_events', 'crm_match_decisions']) {
   result(`Table ${name} with RLS`, schema.some(t => t.tablename === name && t.rowsecurity === true));
  }
 }
 const migrations = await request('Migration history', `${endpoint}/database/query`, { headers, method: 'POST', body: JSON.stringify({ read_only: true, query: 'select version from supabase_migrations.schema_migrations order by version' }) });
 if (Array.isArray(migrations)) console.log(`INFO Recorded migration versions: ${migrations.map(m => m.version).join(', ')}`);
 const bucket = await request('Property media bucket', `${endpoint}/database/query`, { headers, method: 'POST', body: JSON.stringify({ read_only: true, query: "select id, public from storage.buckets where id = 'crm-property-media'" }) });
 if (Array.isArray(bucket)) result('Private property media bucket', bucket.some(b => b.id === 'crm-property-media' && b.public === false));
}
console.log('This audit does not verify real-user CRUD, tenant isolation, signed Storage, email delivery, external providers or Edge behavior. Run the activation journeys before declaring Supabase operational.');
process.exitCode = failed ? 1 : 0;
