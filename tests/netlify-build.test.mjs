import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

test('public landing page never links to or mentions the private dashboard', async () => {
  const html = await readFile(path.join(root, 'src/landing.html'), 'utf8');
  assert.doesNotMatch(html, /dashboard/i);
  assert.doesNotMatch(html, /\/dashboard/i);
});

test('photo confirmation stays public-safe', async () => {
  const html = await readFile(path.join(root, 'src/landing.html'), 'utf8');
  const confirmation = html.match(/<div class="saved-state" id="photo-success"[\s\S]*?<\/div>/)?.[0] || '';
  assert.match(confirmation, /Photo received/);
  assert.doesNotMatch(confirmation, /dashboard|admin/i);
});

test('brand, social sharing, and install metadata use the approved assets', async () => {
  const html = await readFile(path.join(root, 'src/landing.html'), 'utf8');
  assert.match(html, /<title>Itty Bitty Trucks \| Kei Trucks in Boca Raton<\/title>/);
  assert.match(html, /src="\/assets\/itty-bitty-trucks-logo\.png"/);
  assert.match(html, /property="og:image" content="https:\/\/ittybittytrucks\.netlify\.app\/assets\/social-share\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="icon" href="\/favicon\.ico" sizes="any"/);
  assert.match(html, /rel="icon" href="\/assets\/favicon-16\.png" type="image\/png" sizes="16x16"/);
  assert.match(html, /rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/site\.webmanifest"/);
  const manifest = JSON.parse(await readFile(path.join(root, 'assets/site.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Itty Bitty Trucks');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512', '512x512']);
  const social = await readFile(path.join(root, 'assets/social-share.png'));
  assert.equal(social.readUInt32BE(16), 1200);
  assert.equal(social.readUInt32BE(20), 630);
});

test('browser titles are concise and descriptive on every HTML page', async () => {
  const landing = await readFile(path.join(root, 'src/landing.html'), 'utf8');
  const dashboard = await readFile(path.join(root, 'src/dashboard.html'), 'utf8');
  const notFound = await readFile(path.join(root, 'src/404.html'), 'utf8');
  const privacy = await readFile(path.join(root, 'src/privacy.html'), 'utf8');
  assert.match(landing, /<title>Itty Bitty Trucks \| Kei Trucks in Boca Raton<\/title>/);
  assert.match(dashboard, /<title>Owner Dashboard \| Itty Bitty Trucks<\/title>/);
  assert.match(notFound, /<title>Page Not Found \| Itty Bitty Trucks<\/title>/);
  assert.match(privacy, /<title>Privacy Policy \| Itty Bitty Trucks<\/title>/);
});

test('privacy policy is prominent, specific to current collection, and ad-ready', async () => {
  const landing = await readFile(path.join(root, 'src/landing.html'), 'utf8');
  const privacy = await readFile(path.join(root, 'src/privacy.html'), 'utf8');
  assert.match(landing, /href="\/privacy\/">Privacy<\/a>/);
  assert.match(privacy, /Email updates/);
  assert.match(privacy, /Truck inquiries/);
  assert.match(privacy, /Truck sightings/);
  assert.match(privacy, /ib_visit/);
  assert.match(privacy, /We do not currently use the TikTok Pixel/);
  assert.match(privacy, /We do not sell personal information/);
  assert.match(privacy, /mailto:beejeezum@gmail\.com/);
});

test('the singular domain permanently redirects to the plural domain', async () => {
  const config = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(config, /from = "https:\/\/ittybittytruck\.com\/\*"/);
  assert.match(config, /to = "https:\/\/ittybittytrucks\.com\/:splat"/);
  assert.match(config, /status = 301/);
});
