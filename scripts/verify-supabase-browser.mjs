const { chromium } = await import(process.env.STATEHUBS_PLAYWRIGHT_MODULE || '/workspace/.browser-check/node_modules/playwright/index.mjs');
const { owner, viewer, appId } = JSON.parse(process.env.STATEHUBS_SMOKE_SESSIONS);
const base = 'http://127.0.0.1:8080';
const project = new URL(process.env.VITE_SUPABASE_URL || 'https://evnhkxnpdctbsbwppcen.supabase.co').origin;
const browser = await chromium.launch({ executablePath: process.env.STATEHUBS_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
async function contextFor(session, width) {
 const page = await browser.newPage({ viewport: { width, height: 1000 } });
 // Keep TLS verification and use the cloud's supported HTTPS proxy via Node.
 await page.route(project+'/**', async route => {
  try {
  const request = route.request();
  const response = await fetch(request.url(), { method: request.method(), headers: await request.allHeaders(), body: ['GET','HEAD'].includes(request.method()) ? undefined : request.postDataBuffer(), signal: AbortSignal.timeout(30000) });
  const headers = Object.fromEntries(response.headers);
  delete headers['content-encoding']; delete headers['content-length'];
  await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  } catch { await route.abort('failed'); }
 });
 const hash = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', type: 'magiclink' });
 await page.goto(`${base}/auth/callback?next=${encodeURIComponent('/app/'+appId)}#${hash}`, { waitUntil: 'domcontentloaded' });
 await page.getByRole('heading', { level: 1, name: 'Properties', exact: true }).waitFor({ timeout: 45000 });
 return page;
}
async function property(page) {
 const feed = page.getByRole('region', { name: 'Property feed', exact: true });
 for (let i = 0; i < 20; i++) {
  if (await feed.getByRole('heading', { name: 'Verification property', exact: true }).count()) return feed;
  await feed.getByRole('button', { name: 'Next property', exact: true }).click();
 }
 throw new Error('Verification record missing from feed');
}
try {
 for (const width of [390,1440]) {
  const page = await contextFor(owner,width);
  await page.getByText('Connected workspace', { exact: true }).waitFor();
  let feed = await property(page);
  await feed.getByRole('button', { name: 'Activity', exact: true }).click();
  const note = `Browser persistence check ${width}`;
  await feed.getByLabel('Activity details').fill(note);
  await feed.getByRole('button', { name: 'Save activity', exact: true }).click();
  await feed.getByText(note, { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { level: 1, name: 'Properties', exact: true }).waitFor();
  feed = await property(page);
  await feed.getByRole('button', { name: 'Activity', exact: true }).click();
  await feed.getByText(note, { exact: true }).waitFor();
  await feed.getByRole('img').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('[aria-label="Property feed"] img'); return image?.complete && image.naturalWidth > 0; }, null, { timeout: 25000 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal page overflow');
  await page.screenshot({ path: `/tmp/statehubs-live-${width}.png`, fullPage: true });
  console.log(`PASS real Supabase browser ${width}px: auth callback, connected property feed, signed media and note persistence after reload`);
  await page.close();
 }
 const page = await contextFor(viewer,390);
 await page.getByText('Read-only access', { exact: true }).waitFor();
 const feed = await property(page);
 await feed.getByRole('button', { name: 'Activity', exact: true }).click();
 await feed.getByText('Browser persistence check 390', { exact: true }).waitFor();
 if (await feed.getByLabel('Activity details').count()) throw new Error('Viewer was given a write form');
 await feed.locator('summary[aria-label="Property actions"]').click();
 if (await feed.getByRole('button', { name: 'Delete property', exact: true }).count()) throw new Error('Viewer was given a delete action');
 console.log('PASS real Supabase viewer browser: notes visible, no activity write form or delete action');
 await page.close();
} catch(e) {
 const safe = ['Verification record missing from feed','Signed property image did not decode','Horizontal page overflow','Viewer was given a write form','Viewer was given a delete action']; const message=String(e.message).split('\n')[0].replaceAll(owner.access_token,'[session]').replaceAll(owner.refresh_token,'[session]').replaceAll(viewer.access_token,'[session]').replaceAll(viewer.refresh_token,'[session]').replace(/https?:\/\/\S+/g,'[URL]'); console.error('Live browser verification failed: '+e.name+'; '+message.slice(0,250));
 process.exitCode=1;
} finally { await browser.close(); }
