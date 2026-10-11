// Exports the reels to MP4 (1080×1920, 30 fps), frame by frame.
// Needs: npm run build && npx vite preview --port 4173, `npm i -D playwright`
// (plus `npx playwright install chromium`) and ffmpeg.
// Usage: node scripts/render-reels.mjs marca erp piezas hoy sectores ia empresa
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.env.REELS_URL ?? 'http://127.0.0.1:4173';
const keys = process.argv.slice(2);
const FPS = 30;
const browser = await chromium.launch();
for (const key of keys) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(`${base}/reels/${key}?capture=1`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*{animation-play-state:paused!important}' });
  await page.waitForFunction(() => window.__reel?.ready);
  const duration = await page.evaluate(() => window.__reel.duration);
  const dir = `reel-frames-${key}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  for (let i = 0; i < Math.round(duration * FPS); i++) {
    await page.evaluate((s) => window.__reel.set(s), i / FPS);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, quality: 92 });
  }
  await page.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `statehubs-reel-${key}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  console.log('listo', key);
}
await browser.close();
