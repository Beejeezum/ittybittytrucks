import { getStore, getDeployStore } from '@netlify/blobs';
import { getDatabase } from '@netlify/database';
import { getUser } from '@netlify/identity';
import type { Config, Context } from '@netlify/functions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PHOTO = 2 * 1024 * 1024;
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const reply = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

function visitor(request: Request) {
  const value = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ib_visit='))?.slice(9);
  return value && UUID.test(value) ? value : null;
}

async function readBounded(request: Request, limit: number) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, 'That’s a little too large. Try something smaller.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Something is missing. Please try again.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new HttpError(413, 'That’s a little too large. Try something smaller.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function readJson(request: Request, limit = 4096) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Please use the form on this page.');
  const bytes = await readBounded(request, limit);
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, 'Something is missing. Please try again.');
}

async function rateLimit(context: Context, visitorKey: string, route: string, maximum: number) {
  const hour = Math.floor(Date.now() / 3600000);
  const identity = context.ip || visitorKey;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${hour}:${route}:${identity}`));
  const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
  const db = getDatabase();
  const rows = await db.sql`
    INSERT INTO submission_limits (key, bucket, count)
    VALUES (${hash}, ${hour}, 1)
    ON CONFLICT (key) DO UPDATE SET count = submission_limits.count + 1
    RETURNING count
  `;
  await db.sql`DELETE FROM submission_limits WHERE bucket < ${hour - 48}`;
  if (Number(rows[0]?.count || 0) > maximum) throw new HttpError(429, 'You’ve sent a few already. Give it a little while, then try again.');
}

async function hello(request: Request) {
  const existing = visitor(request);
  const key = existing || crypto.randomUUID();
  const db = getDatabase();
  const rows = await db.sql`SELECT value FROM visitor_signals WHERE visitor_key = ${key} AND kind = 'love' LIMIT 1`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return reply({ loved: rows[0]?.value === 'yes' }, 200, existing ? {} : { 'Set-Cookie': `ib_visit=${key}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${secure}` });
}

async function signal(request: Request, context: Context, key: string) {
  const { kind, value } = await readJson(request);
  if (kind !== 'love' || value !== 'yes') throw new HttpError(400, 'Choose one of the buttons on this page.');
  await rateLimit(context, key, 'signal', 40);
  const now = new Date().toISOString();
  const db = getDatabase();
  await db.sql`
    INSERT INTO visitor_signals (visitor_key, kind, value, created_at, updated_at)
    VALUES (${key}, 'love', 'yes', ${now}, ${now})
    ON CONFLICT (visitor_key, kind) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `;
  return reply({ ok: true });
}

async function contact(request: Request, context: Context, key: string) {
  const body = await readJson(request);
  const { intent, method, website, requestId } = body;
  const raw = body.contact;
  if (website) throw new HttpError(400, 'Please leave the website field empty.');
  if (!UUID.test(String(requestId || '')) || !['follow', 'truck'].includes(String(intent)) || !['email', 'phone'].includes(String(method)) || typeof raw !== 'string' || (intent === 'follow' && method !== 'email')) {
    throw new HttpError(400, 'Check your details and try again.');
  }
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
  const db = getDatabase();
  const prior = await db.sql`SELECT visitor_key FROM truck_requests WHERE request_key = ${requestId} LIMIT 1`;
  if (prior[0]) {
    if (String(prior[0].visitor_key) !== key) throw new HttpError(409, 'Please refresh and try again.');
    return reply({ ok: true });
  }
  await rateLimit(context, key, 'contact', 10);
  const consent = intent === 'follow' ? 'Email updates about trucks, local happenings, and new projects.' : 'Reply about finding a truck. No subscription to email updates.';
  await db.sql`
    INSERT INTO truck_requests (id, request_key, visitor_key, intent, contact_type, contact_value, consent, created_at, status)
    VALUES (${crypto.randomUUID()}, ${requestId}, ${key}, ${intent}, ${method}, ${value}, ${consent}, ${new Date().toISOString()}, 'new')
    ON CONFLICT (request_key) DO NOTHING
  `;
  return reply({ ok: true });
}

function photoStore(context: Context) {
  return context.deploy.context === 'production'
    ? getStore({ name: 'ittybitty-photos', consistency: 'strong' })
    : getDeployStore({ name: 'ittybitty-photos' });
}

async function photo(request: Request, context: Context, key: string) {
  const requestId = request.headers.get('X-Request-ID');
  if (!UUID.test(requestId || '')) throw new HttpError(400, 'Choose your photo again, then send it.');
  if (request.headers.get('Content-Type') !== 'image/jpeg') throw new HttpError(415, 'Choose a photo using the button on this page.');
  const bytes = await readBounded(request, MAX_PHOTO);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new HttpError(400, 'That photo didn’t load. Try another one.');
  const db = getDatabase();
  const prior = await db.sql`SELECT visitor_key FROM truck_sightings WHERE request_key = ${requestId} LIMIT 1`;
  if (prior[0]) {
    if (String(prior[0].visitor_key) !== key) throw new HttpError(409, 'Choose your photo again, then send it.');
    return reply({ ok: true });
  }
  await rateLimit(context, key, 'photo', 5);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKey = `truck-sightings/${now.slice(0, 7)}/${id}.jpg`;
  const store = photoStore(context);
  await store.set(objectKey, bytes.slice().buffer);
  try {
    await db.sql`
      INSERT INTO truck_sightings (id, request_key, visitor_key, object_key, byte_size, created_at)
      VALUES (${id}, ${requestId}, ${key}, ${objectKey}, ${bytes.length}, ${now})
    `;
  } catch (error) {
    await store.delete(objectKey).catch(() => {});
    throw error;
  }
  return reply({ ok: true });
}

async function recordVisit(request: Request, context: Context, key: string) {
  const { sessionId, referrer, device } = await readJson(request);
  if (!UUID.test(String(sessionId || '')) || !['mobile', 'desktop', 'tablet'].includes(String(device))) throw new HttpError(400, 'Invalid visit.');
  let host = '';
  if (typeof referrer === 'string' && referrer.length < 2048) {
    try {
      const source = new URL(referrer);
      if (['http:', 'https:'].includes(source.protocol) && source.hostname !== new URL(request.url).hostname) host = source.hostname.slice(0, 200);
    } catch {}
  }
  await rateLimit(context, key, 'visit', 2400);
  const now = new Date().toISOString();
  const db = getDatabase();
  await db.sql`
    INSERT INTO site_visits (id, visitor_key, started_at, last_seen_at, referrer_host, device)
    VALUES (${sessionId}, ${key}, ${now}, ${now}, ${host}, ${device})
    ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
      WHERE site_visits.visitor_key = EXCLUDED.visitor_key
  `;
  return reply({ ok: true });
}

async function requireOwner() {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in to see your dashboard.');
  const owner = Netlify.env.get('OWNER_EMAIL')?.trim().toLowerCase();
  if (!owner || user.email?.trim().toLowerCase() !== owner) throw new HttpError(403, 'This dashboard is private to Bruce.');
}

const temporaryMigrationHash = '707248520e4d28802ed0e568607c05b69096b08060f7526431f71b16954d1721';

async function requireMigrationToken(request: Request) {
  const token = request.headers.get('X-Migration-Token') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const actual = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
  if (actual !== temporaryMigrationHash) throw new HttpError(404, 'Not found.');
}

async function importRows(request: Request) {
  await requireMigrationToken(request);
  const payload = await readJson(request, 128 * 1024);
  const requests = Array.isArray(payload.truck_requests) ? payload.truck_requests : [];
  const signals = Array.isArray(payload.visitor_signals) ? payload.visitor_signals : [];
  const visits = Array.isArray(payload.site_visits) ? payload.site_visits : [];
  const db = getDatabase();

  for (const row of requests as Record<string, unknown>[]) {
    await db.sql`
      INSERT INTO truck_requests (id, request_key, visitor_key, intent, contact_type, contact_value, consent, created_at, status)
      VALUES (${String(row.id)}, ${String(row.request_key)}, ${String(row.visitor_key)}, ${String(row.intent)}, ${String(row.contact_type)}, ${String(row.contact_value)}, ${String(row.consent)}, ${String(row.created_at)}, ${String(row.status)})
      ON CONFLICT (request_key) DO NOTHING
    `;
  }
  for (const row of signals as Record<string, unknown>[]) {
    await db.sql`
      INSERT INTO visitor_signals (visitor_key, kind, value, created_at, updated_at)
      VALUES (${String(row.visitor_key)}, ${String(row.kind)}, ${String(row.value)}, ${String(row.created_at)}, ${String(row.updated_at)})
      ON CONFLICT (visitor_key, kind) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `;
  }
  for (const row of visits as Record<string, unknown>[]) {
    await db.sql`
      INSERT INTO site_visits (id, visitor_key, started_at, last_seen_at, referrer_host, device)
      VALUES (${String(row.id)}, ${String(row.visitor_key)}, ${String(row.started_at)}, ${String(row.last_seen_at)}, ${String(row.referrer_host || '')}, ${String(row.device)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  return reply({ ok: true, imported: { requests: requests.length, signals: signals.length, visits: visits.length } });
}

async function importPhoto(request: Request, context: Context) {
  await requireMigrationToken(request);
  if (request.headers.get('Content-Type') !== 'image/jpeg') throw new HttpError(415, 'Not found.');
  const id = request.headers.get('X-Migration-ID') || '';
  const requestKey = request.headers.get('X-Migration-Request-ID') || '';
  const visitorKey = request.headers.get('X-Migration-Visitor-Key') || '';
  const createdAt = request.headers.get('X-Migration-Created-At') || '';
  if (![id, requestKey, visitorKey].every((value) => UUID.test(value)) || Number.isNaN(Date.parse(createdAt))) throw new HttpError(400, 'Not found.');
  const bytes = await readBounded(request, MAX_PHOTO);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new HttpError(400, 'Not found.');
  const objectKey = `truck-sightings/${createdAt.slice(0, 7)}/${id}.jpg`;
  const store = photoStore(context);
  await store.set(objectKey, bytes.slice().buffer);
  const db = getDatabase();
  await db.sql`
    INSERT INTO truck_sightings (id, request_key, visitor_key, object_key, byte_size, created_at)
    VALUES (${id}, ${requestKey}, ${visitorKey}, ${objectKey}, ${bytes.length}, ${createdAt})
    ON CONFLICT (request_key) DO NOTHING
  `;
  return reply({ ok: true, imported: { photos: 1 } });
}

async function dashboard(request: Request) {
  await requireOwner();
  const url = new URL(request.url);
  const requested = url.searchParams.get('kind');
  const kind = ['all', 'follow', 'truck', 'love', 'photo', 'visit'].includes(requested || '') ? requested! : 'all';
  const now = new Date();
  const recent = new Date(now.getTime() - 90000).toISOString();
  const day = new Date(now.getTime() - 86400000).toISOString();
  const db = getDatabase();
  const metricsRows = await db.sql`
    SELECT
      (SELECT COUNT(DISTINCT visitor_key)::int FROM site_visits WHERE last_seen_at >= ${recent}) AS active,
      (SELECT COUNT(*)::int FROM site_visits WHERE started_at >= ${day}) AS visits,
      (SELECT COUNT(*)::int FROM visitor_signals WHERE kind = 'love') AS love,
      (SELECT COUNT(*)::int FROM truck_requests WHERE intent = 'follow') AS followers,
      (SELECT COUNT(*)::int FROM truck_requests WHERE intent = 'truck') AS requests,
      (SELECT COUNT(*)::int FROM truck_sightings) AS photos
  `;
  const events = await db.sql`
    SELECT * FROM (
      SELECT id::text, intent AS kind, contact_type, contact_value, created_at, status, ''::text AS source FROM truck_requests
      UNION ALL SELECT 'love:' || visitor_key, 'love', '', '', created_at, '', '' FROM visitor_signals WHERE kind = 'love'
      UNION ALL SELECT id::text, 'photo', '', '', created_at, '', '' FROM truck_sightings
      UNION ALL SELECT 'visit:' || id::text, 'visit', device, '', started_at, '', referrer_host FROM site_visits
    ) AS feed
    WHERE (${kind} = 'all' OR kind = ${kind})
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const activity = await db.sql`
    SELECT date_trunc('hour', started_at) AS hour, COUNT(*)::int AS count
    FROM site_visits
    WHERE started_at >= ${day}
    GROUP BY hour
    ORDER BY hour
  `;
  return reply({ metrics: metricsRows[0], events, activity, generatedAt: now.toISOString(), activeWindowSeconds: 90, notificationEmailConfigured: false }, 200, privateHeaders);
}

async function ownerPhoto(context: Context, id: string) {
  await requireOwner();
  const db = getDatabase();
  const rows = await db.sql`SELECT object_key FROM truck_sightings WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) throw new HttpError(404, 'Photo not found.');
  const image = await photoStore(context).get(String(rows[0].object_key), { type: 'arrayBuffer' });
  if (!image) throw new HttpError(404, 'Photo not found.');
  return new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline', ...privateHeaders } });
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${/^[=+\-@\t\r]/.test(text) ? "'" : ''}${text.replaceAll('"', '""')}"`;
}

async function exportContacts(request: Request) {
  await requireOwner();
  const intent = new URL(request.url).searchParams.get('intent') === 'truck' ? 'truck' : 'follow';
  const db = getDatabase();
  const contacts = await db.sql`
    SELECT contact_type, contact_value, created_at, consent
    FROM truck_requests
    WHERE intent = ${intent}
    ORDER BY created_at DESC
    LIMIT 10000
  `;
  const rows = [['method', 'contact', 'signed_up_at', 'permission'], ...contacts.map((row) => [row.contact_type, row.contact_value, row.created_at, row.consent])];
  const body = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ittybitty-${intent === 'follow' ? 'followers' : 'truck-requests'}.csv"`, ...privateHeaders } });
}

async function route(request: Request, context: Context) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/hello') return hello(request);
  if (request.method === 'POST' && url.pathname === '/api/_migrate/rows') return importRows(request);
  if (request.method === 'POST' && url.pathname === '/api/_migrate/photo') return importPhoto(request, context);
  if (url.pathname === '/api/dashboard' && request.method === 'GET') return dashboard(request);
  if (url.pathname === '/api/dashboard/export' && request.method === 'GET') return exportContacts(request);
  const photoId = url.pathname.match(/^\/api\/dashboard\/photos\/([0-9a-f-]+)$/i)?.[1];
  if (photoId && UUID.test(photoId) && request.method === 'GET') return ownerPhoto(context, photoId);
  if (request.method !== 'POST') throw new HttpError(404, 'Not found.');
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, 'Please send this from the truck’s website.');
  const key = visitor(request);
  if (!key) throw new HttpError(409, 'Refresh the page, then give that another try.');
  if (url.pathname === '/api/signal') return signal(request, context, key);
  if (url.pathname === '/api/contact') return contact(request, context, key);
  if (url.pathname === '/api/photo') return photo(request, context, key);
  if (url.pathname === '/api/visit') return recordVisit(request, context, key);
  throw new HttpError(404, 'Not found.');
}

export default async (request: Request, context: Context) => {
  try {
    return await route(request, context);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('Truck site request failed', { path: new URL(request.url).pathname, message: error instanceof Error ? error.message : String(error) });
    return reply({ error: error instanceof HttpError ? error.message : 'That didn’t go through. Your details are still here—try again.' }, error instanceof HttpError ? error.status : 503, new URL(request.url).pathname.startsWith('/api/dashboard') ? privateHeaders : {});
  }
};

export const config: Config = {
  path: [
    '/api/hello',
    '/api/_migrate/rows',
    '/api/_migrate/photo',
    '/api/signal',
    '/api/contact',
    '/api/photo',
    '/api/visit',
    '/api/dashboard',
    '/api/dashboard/export',
    '/api/dashboard/photos/:id',
  ],
};
