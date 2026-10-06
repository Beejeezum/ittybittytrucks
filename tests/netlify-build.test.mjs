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
