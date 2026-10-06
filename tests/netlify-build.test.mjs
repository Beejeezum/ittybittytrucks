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
  assert.match(html, /rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/site\.webmanifest"/);
  const manifest = JSON.parse(await readFile(path.join(root, 'assets/site.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Itty Bitty Trucks');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512', '512x512']);
  const social = await readFile(path.join(root, 'assets/social-share.png'));
  assert.equal(social.readUInt32BE(16), 1200);
  assert.equal(social.readUInt32BE(20), 630);
});
