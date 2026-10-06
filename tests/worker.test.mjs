import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import { createLocalEnv } from '../scripts/local-env.mjs';

async function setup(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'itty-truck-test-'));
  const local = await createLocalEnv(directory);
  t.after(async () => { local.close(); await rm(directory, { recursive: true, force: true }); });
  const url = 'https://ittybittytrucks.com';
  const hello = await worker.fetch(new Request(url + '/api/hello'), local.env);
  assert.equal(hello.status, 200);
  const cookie = hello.headers.get('Set-Cookie').split(';')[0];
  const send = (route, payload, headers = {}) => worker.fetch(new Request(url + route, { method: 'POST', headers: { Origin: url, Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: payload instanceof Uint8Array ? payload : JSON.stringify(payload) }), local.env);
  return { ...local, url, cookie, send };
}

test('follow signup and truck inquiry save distinct consent; retries do not duplicate', async (t) => {
  const { send, sqlite } = await setup(t);
  const follow = { intent: 'follow', method: 'email', contact: ' Mobile-QA@example.invalid ', requestId: crypto.randomUUID(), website: '' };
  assert.equal((await send('/api/contact', follow)).status, 200);
  assert.equal((await send('/api/contact', follow)).status, 200);
  const inquiry = { intent: 'truck', method: 'phone', contact: '(202) 555-0123', requestId: crypto.randomUUID(), website: '' };
  assert.equal((await send('/api/contact', inquiry)).status, 200);
  const rows = sqlite.prepare('SELECT intent, contact_value, consent FROM truck_requests ORDER BY created_at').all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].contact_value, 'mobile-qa@example.invalid');
  assert.match(rows[0].consent, /Email updates/);
  assert.equal(rows[1].contact_value, '+12025550123');
  assert.match(rows[1].consent, /No subscription/);
});

test('invalid, cross-site, oversized, and bot submissions are rejected before saving', async (t) => {
  const { send, sqlite } = await setup(t);
  const base = { intent: 'follow', method: 'email', contact: 'qa@example.invalid', requestId: crypto.randomUUID() };
  assert.equal((await send('/api/contact', { ...base, contact: 'not-an-email' })).status, 400);
  assert.equal((await send('/api/contact', { ...base, method: 'phone' })).status, 400);
  assert.equal((await send('/api/contact', { ...base, website: 'spam' })).status, 400);
  assert.equal((await send('/api/contact', base, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await send('/api/contact', { ...base, contact: 'x'.repeat(6000) })).status, 413);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM truck_requests').get().count, 0);
});

test('love persists once per visitor and is restored on reload', async (t) => {
  const { send, sqlite, url, cookie, env } = await setup(t);
  for (let i = 0; i < 2; i++) assert.equal((await send('/api/signal', { kind: 'love', value: 'yes' })).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM visitor_signals').get().count, 1);
  const response = await worker.fetch(new Request(url + '/api/hello', { headers: { Cookie: cookie } }), env);
  assert.equal((await response.json()).loved, true);
});

test('photo upload persists privately and retries do not duplicate', async (t) => {
  const { send, sqlite, url, env } = await setup(t);
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 2, 255, 217]);
  const headers = { 'Content-Type': 'image/jpeg', 'X-Request-ID': crypto.randomUUID() };
  assert.equal((await send('/api/photo', bytes, headers)).status, 200);
  assert.equal((await send('/api/photo', bytes, headers)).status, 200);
  const rows = sqlite.prepare('SELECT * FROM truck_sightings').all();
  assert.equal(rows.length, 1);
  assert.equal((await env.BUCKET.get(rows[0].object_key)).body.length, bytes.length);
  const privateUrl = url + '/sighting/' + rows[0].id;
  assert.equal((await worker.fetch(new Request(privateUrl + '/wrong'), env)).status, 404);
  assert.equal((await worker.fetch(new Request(privateUrl + '/' + rows[0].view_key), env)).status, 404);
  const response = await worker.fetch(new Request(url + '/api/dashboard/photos/' + rows[0].id, { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.OWNER_EMAIL } }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await send('/api/photo', new Uint8Array([0, 1, 2, 3]), { ...headers, 'X-Request-ID': crypto.randomUUID() })).status, 400);
  assert.equal((await send('/api/photo', new Uint8Array(2 * 1024 * 1024 + 1), { ...headers, 'X-Request-ID': crypto.randomUUID() })).status, 413);
});

test('storage failure does not return success or keep orphaned images', async (t) => {
  const { env, url, cookie } = await setup(t);
  const request = new Request(url + '/api/contact', { method: 'POST', headers: { Origin: url, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'follow', method: 'email', contact: 'qa@example.invalid', requestId: crypto.randomUUID() }) });
  assert.equal((await worker.fetch(request, {})).status, 503);
  let objects = 0;
  const original = env.DB.prepare;
  env.DB.prepare = (sql) => sql.startsWith('INSERT INTO truck_sightings') ? { bind: () => ({ run: async () => { throw new Error('Simulated storage failure'); } }) } : original(sql);
  env.BUCKET = { put: async () => { objects++; }, delete: async () => { objects--; } };
  const photo = new Request(url + '/api/photo', { method: 'POST', headers: { Origin: url, Cookie: cookie, 'Content-Type': 'image/jpeg', 'X-Request-ID': crypto.randomUUID() }, body: new Uint8Array([255, 216, 255, 217]) });
  assert.equal((await worker.fetch(photo, env)).status, 503);
  assert.equal(objects, 0);
});

test('landing and redirects work without exposing contacts', async (t) => {
  const { env, url } = await setup(t);
  const response = await worker.fetch(new Request(url), env);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Stick around/);
  const singular = await worker.fetch(new Request('https://ittybittytruck.com/'), env);
  assert.equal(singular.status, 301); assert.equal(singular.headers.get('Location'), url + '/');
  const old = await worker.fetch(new Request(url + '/find-me-one/'), env);
  assert.equal(old.status, 301); assert.equal(old.headers.get('Location'), url + '/#truck');
  assert.equal((await worker.fetch(new Request(url + '/api/contact'), env)).status, 404);
  assert.equal((await worker.fetch(new Request(url + '/api/photo'), env)).status, 404);
});


test('dashboard and photo routes fail closed for anonymous and nonowner identities', async (t) => {
  const { env, url, send, sqlite } = await setup(t);
  const photoHeaders = { 'Content-Type': 'image/jpeg', 'X-Request-ID': crypto.randomUUID() };
  await send('/api/photo', new Uint8Array([255, 216, 255, 217]), photoHeaders);
  const photo = sqlite.prepare('SELECT id FROM truck_sightings').get();
  const paths = ['/dashboard', '/dashboard/', '/api/dashboard', '/api/dashboard/export', '/api/dashboard/photos/' + photo.id];
  const identities = [
    [{}, 401],
    [{ 'oai-authenticated-user-email': env.OWNER_EMAIL }, 401],
    [{ 'oai-authenticated-user-id': 'owner' }, 401],
    [{ 'oai-authenticated-user-id': 'stranger', 'oai-authenticated-user-email': 'stranger@example.invalid' }, 403],
  ];
  for (const route of paths) {
    for (const [headers, status] of identities) {
      const response = await worker.fetch(new Request(url + route, { headers }), env);
      assert.equal(response.status, route.startsWith('/dashboard') && status === 401 ? 302 : status, route);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.doesNotMatch(await response.text(), /contact_value|object_key|view_key/);
    }
    const authorized = await worker.fetch(new Request(url + route, { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.OWNER_EMAIL } }), env);
    assert.equal(authorized.status, 200, route);
    assert.equal(authorized.headers.get('Cache-Control'), 'private, no-store');
  }
  const noOwnerSetting = { ...env, OWNER_EMAIL: '' };
  assert.equal((await worker.fetch(new Request(url + '/api/dashboard', { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.OWNER_EMAIL } }), noOwnerSetting)).status, 403);
  assert.equal((await worker.fetch(new Request(url + '/dashboard.html'), env)).status, 404);
});

test('presence is one visit per session and active browsers expire after 90 seconds', async (t) => {
  const { env, url, send, sqlite } = await setup(t);
  const visit = { sessionId: crypto.randomUUID(), referrer: 'https://example.org/private/path?secret=value', device: 'mobile' };
  assert.equal((await send('/api/visit', visit)).status, 200);
  assert.equal((await send('/api/visit', visit)).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM site_visits').get().count, 1);
  assert.equal(sqlite.prepare('SELECT referrer_host FROM site_visits').get().referrer_host, 'example.org');
  const request = () => new Request(url + '/api/dashboard', { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.OWNER_EMAIL } });
  let data = await (await worker.fetch(request(), env)).json();
  assert.equal(data.metrics.active, 1); assert.equal(data.metrics.visits, 1);
  assert.equal(data.events.filter((event) => event.kind === 'visit').length, 1);
  sqlite.prepare('UPDATE site_visits SET last_seen_at = ?').run(new Date(Date.now() - 120000).toISOString());
  data = await (await worker.fetch(request(), env)).json();
  assert.equal(data.metrics.active, 0); assert.equal(data.metrics.visits, 1);
});

test('dashboard feed has useful contact data without private photo keys; CSV neutralizes formulas', async (t) => {
  const { env, url, send } = await setup(t);
  const unusualEmail = '=formula@example.invalid';
  await send('/api/contact', { intent: 'follow', method: 'email', contact: unusualEmail, requestId: crypto.randomUUID() });
  const headers = { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.OWNER_EMAIL };
  const data = await (await worker.fetch(new Request(url + '/api/dashboard?kind=follow', { headers }), env)).json();
  assert.equal(data.events.length, 1); assert.equal(data.events[0].contact_value, unusualEmail);
  assert.equal(data.metrics.followers, 1);
  assert.equal(data.notificationEmailConfigured, false);
  assert.doesNotMatch(JSON.stringify(data), /object_key|view_key|visitor_key/);
  const csv = await (await worker.fetch(new Request(url + '/api/dashboard/export', { headers }), env)).text();
  assert.ok(csv.includes("'=formula@example.invalid"));
});
