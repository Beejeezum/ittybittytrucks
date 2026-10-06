import { assets } from './site-assets.js';
import { ownerAccess, privateHeaders, dashboardData, ownerPhoto, exportContacts } from './dashboard.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PHOTO = 2 * 1024 * 1024;
const LEGACY = new Map([['/hi/teal', '/'], ['/trucks', '/#about'], ['/trucks/teal-sambar', '/#about'], ['/tiny-truck-101', '/#about'], ['/our-story', '/'], ['/find-me-one', '/#truck'], ['/index.html', '/']]);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function database(env) { if (!env.DB) throw new Error('DB binding unavailable'); return env.DB; }
function bucket(env) { if (!env.BUCKET) throw new Error('BUCKET binding unavailable'); return env.BUCKET; }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } }); }
function visitor(request) {
  const value = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ib_visit='))?.slice(9);
  return value && UUID.test(value) ? value : null;
}
async function readBounded(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, 'That’s a little too large. Try something smaller.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Something is missing. Please try again.');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new HttpError(413, 'That’s a little too large. Try something smaller.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function readJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Please use the form on this page.');
  const bytes = await readBounded(request, 4096);
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); if (data && typeof data === 'object' && !Array.isArray(data)) return data; } catch {}
  throw new HttpError(400, 'Something is missing. Please try again.');
}
async function rateLimit(request, env, key, route, maximum) {
  const hour = Math.floor(Date.now() / 3600000);
  const identity = request.headers.get('CF-Connecting-IP') || key;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${hour}:${route}:${identity}`));
  const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
  const db = database(env);
  const [result] = await db.batch([
    db.prepare('INSERT INTO submission_limits (key, bucket, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(hash, hour),
    db.prepare('DELETE FROM submission_limits WHERE bucket < ?').bind(hour - 48),
  ]);
  if (result.results[0].count > maximum) throw new HttpError(429, 'You’ve sent a few already. Give it a little while, then try again.');
}
async function hello(request, env) {
  const existing = visitor(request); const key = existing || crypto.randomUUID();
  const row = await database(env).prepare('SELECT value FROM visitor_signals WHERE visitor_key = ? AND kind = ?').bind(key, 'love').first();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return json({ loved: row?.value === 'yes' }, 200, existing ? {} : { 'Set-Cookie': `ib_visit=${key}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${secure}` });
}
async function signal(request, env, key) {
  const { kind, value } = await readJson(request);
  if (kind !== 'love' || value !== 'yes') throw new HttpError(400, 'Choose one of the buttons on this page.');
  await rateLimit(request, env, key, 'signal', 40);
  const now = new Date().toISOString();
  await database(env).prepare('INSERT INTO visitor_signals (visitor_key, kind, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(visitor_key, kind) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, kind, value, now, now).run();
  return json({ ok: true });
}
async function contact(request, env, key) {
  const { intent, method, contact: raw, website, requestId } = await readJson(request);
  if (website) throw new HttpError(400, 'Please leave the website field empty.');
  if (!UUID.test(requestId || '') || !['follow', 'truck'].includes(intent) || !['email', 'phone'].includes(method) || typeof raw !== 'string' || (intent === 'follow' && method !== 'email')) throw new HttpError(400, 'Check your details and try again.');
  let value = raw.trim();
  if (method === 'email') {
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, 'Pop in a valid email address.');
    value = value.toLowerCase();
  } else {
    if (value.length > 30 || !/^[+\d\s().-]+$/.test(value)) throw new HttpError(400, 'Check that number, including the area code.');
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) throw new HttpError(400, 'Check that number, including the area code.');
    value = value.startsWith('+') ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits;
  }
  const db = database(env);
  const prior = await db.prepare('SELECT visitor_key FROM truck_requests WHERE request_key = ?').bind(requestId).first();
  if (prior) { if (prior.visitor_key !== key) throw new HttpError(409, 'Please refresh and try again.'); return json({ ok: true }); }
  await rateLimit(request, env, key, 'contact', 10);
  const consent = intent === 'follow' ? 'Email updates about trucks, local happenings, and new projects.' : 'Reply about finding a truck. No subscription to email updates.';
  await db.prepare('INSERT INTO truck_requests (id, request_key, visitor_key, intent, contact_type, contact_value, consent, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_key) DO NOTHING').bind(crypto.randomUUID(), requestId, key, intent, method, value, consent, new Date().toISOString(), 'new').run();
  return json({ ok: true });
}
async function photo(request, env, key) {
  const requestId = request.headers.get('X-Request-ID');
  if (!UUID.test(requestId || '')) throw new HttpError(400, 'Choose your photo again, then send it.');
  if (request.headers.get('Content-Type') !== 'image/jpeg') throw new HttpError(415, 'Choose a photo using the button on this page.');
  const bytes = await readBounded(request, MAX_PHOTO);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new HttpError(400, 'That photo didn’t load. Try another one.');
  const db = database(env);
  const prior = await db.prepare('SELECT visitor_key FROM truck_sightings WHERE request_key = ?').bind(requestId).first();
  if (prior) { if (prior.visitor_key !== key) throw new HttpError(409, 'Choose your photo again, then send it.'); return json({ ok: true }); }
  await rateLimit(request, env, key, 'photo', 5);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  const objectKey = `truck-sightings/${now.slice(0, 7)}/${id}.jpg`; const store = bucket(env);
  await store.put(objectKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  try {
    const result = await db.prepare('INSERT INTO truck_sightings (id, request_key, visitor_key, object_key, view_key, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_key) DO NOTHING').bind(id, requestId, key, objectKey, crypto.randomUUID() + crypto.randomUUID(), bytes.length, now).run();
    if (result.meta.changes === 0) await store.delete(objectKey);
  } catch (error) { await store.delete(objectKey).catch(() => {}); throw error; }
  return json({ ok: true });
}
async function recordVisit(request, env, key) {
  const { sessionId, referrer, device } = await readJson(request);
  if (!UUID.test(sessionId || '') || !['mobile', 'desktop', 'tablet'].includes(device)) throw new HttpError(400, 'Invalid visit.');
  let host = '';
  if (typeof referrer === 'string' && referrer.length < 2048) {
    try { const source = new URL(referrer); if (['http:', 'https:'].includes(source.protocol) && source.hostname !== new URL(request.url).hostname) host = source.hostname.slice(0, 200); } catch {}
  }
  await rateLimit(request, env, key, 'visit', 2400);
  const now = new Date().toISOString();
  await database(env).prepare('INSERT INTO site_visits (id, visitor_key, started_at, last_seen_at, referrer_host, device) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at WHERE site_visits.visitor_key = excluded.visitor_key').bind(sessionId, key, now, now, host, device).run();
  return json({ ok: true });
}
async function route(request, env) {
  const url = new URL(request.url);
  if (url.hostname === 'ittybittytruck.com') { url.hostname = 'ittybittytrucks.com'; url.protocol = 'https:'; return Response.redirect(url.toString(), ['GET', 'HEAD'].includes(request.method) ? 301 : 308); }
  const dashboardPage = url.pathname === '/dashboard' || url.pathname === '/dashboard/';
  const dashboardAPI = url.pathname === '/api/dashboard' || url.pathname.startsWith('/api/dashboard/');
  if (dashboardPage || dashboardAPI) {
    const access = ownerAccess(request, env);
    if (access !== 200) {
      if (dashboardPage && access === 401) return new Response(null, { status: 302, headers: { Location: '/signin-with-chatgpt?return_to=%2Fdashboard', ...privateHeaders } });
      return json({ error: access === 401 ? 'Sign in to see your dashboard.' : 'This dashboard is private to Bruce.' }, access, privateHeaders);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, privateHeaders);
    if (dashboardPage) return new Response(request.method === 'HEAD' ? null : assets['/dashboard'].body, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...privateHeaders } });
    if (url.pathname === '/api/dashboard') return dashboardData(request, env);
    if (url.pathname === '/api/dashboard/export') return exportContacts(request, env);
    const photoId = url.pathname.match(/^\/api\/dashboard\/photos\/([0-9a-f-]+)$/)?.[1];
    if (photoId && UUID.test(photoId)) return ownerPhoto(photoId, env);
    return json({ error: 'Not found.' }, 404, privateHeaders);
  }
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/hello' && request.method === 'GET') return hello(request, env);
    if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, 'Please send this from the truck’s website.');
    const key = visitor(request);
    if (!key) throw new HttpError(409, 'Refresh the page, then give that another try.');
    if (url.pathname === '/api/signal') return signal(request, env, key);
    if (url.pathname === '/api/contact') return contact(request, env, key);
    if (url.pathname === '/api/photo') return photo(request, env, key);
    if (url.pathname === '/api/visit') return recordVisit(request, env, key);
    return json({ error: 'Not found' }, 404);
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (url.pathname.startsWith('/sighting/')) return new Response('Not found', { status: 404 });
  const old = LEGACY.get(url.pathname.replace(/\/$/, ''));
  if (old) return Response.redirect(new URL(old, url.origin).toString(), 301);
  const asset = assets[url.pathname];
  if (!asset) return new Response('A little lost? Head back to ittybittytrucks.com.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const body = asset.base64 ? Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0)) : asset.body;
  return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': asset.type, 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' } });
}
export default {
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) {
      if (!(error instanceof HttpError)) console.error('Truck site request failed', { path: new URL(request.url).pathname, message: error.message });
      response = json({ error: error instanceof HttpError ? error.message : 'That didn’t go through. Your details are still here—try again.' }, error.status || 503);
    }
    const result = new Response(response.body, response);
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Permissions-Policy', 'geolocation=(), microphone=()');
    if (!result.headers.has('Referrer-Policy')) result.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
    return result;
  },
};
