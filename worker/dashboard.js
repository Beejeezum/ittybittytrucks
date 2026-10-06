export function ownerAccess(request, env) {
  const id = request.headers.get('oai-authenticated-user-id')?.trim();
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!id || !email) return 401;
  if (!env.OWNER_EMAIL || email !== env.OWNER_EMAIL.trim().toLowerCase()) return 403;
  return 200;
}

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Cookie, oai-authenticated-user-id, oai-authenticated-user-email', 'Referrer-Policy': 'no-referrer' };
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...privateHeaders } });

export async function dashboardData(request, env) {
  const url = new URL(request.url);
  const kind = ['all', 'follow', 'truck', 'love', 'photo', 'visit'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'all';
  const now = new Date();
  const recent = new Date(now.getTime() - 90000).toISOString();
  const day = new Date(now.getTime() - 86400000).toISOString();
  const db = env.DB;
  if (!db) return reply({ error: 'The activity feed is temporarily unavailable. Try refreshing in a moment.' }, 503);
  const [metrics, feed, activity] = await db.batch([
    db.prepare(`SELECT
      (SELECT COUNT(DISTINCT visitor_key) FROM site_visits WHERE last_seen_at >= ?) AS active,
      (SELECT COUNT(*) FROM site_visits WHERE started_at >= ?) AS visits,
      (SELECT COUNT(*) FROM visitor_signals WHERE kind = 'love') AS love,
      (SELECT COUNT(*) FROM truck_requests WHERE intent = 'follow') AS followers,
      (SELECT COUNT(*) FROM truck_requests WHERE intent = 'truck') AS requests,
      (SELECT COUNT(*) FROM truck_sightings) AS photos`).bind(recent, day),
    db.prepare(`SELECT * FROM (
      SELECT id, intent AS kind, contact_type, contact_value, created_at, status, '' AS source FROM truck_requests
      UNION ALL SELECT 'love:' || visitor_key, 'love', '', '', created_at, '', '' FROM visitor_signals WHERE kind = 'love'
      UNION ALL SELECT id, 'photo', '', '', created_at, '', '' FROM truck_sightings
      UNION ALL SELECT 'visit:' || id, 'visit', device, '', started_at, '', referrer_host FROM site_visits
    ) WHERE (? = 'all' OR kind = ?) ORDER BY created_at DESC LIMIT 100`).bind(kind, kind),
    db.prepare("SELECT strftime('%Y-%m-%dT%H:00:00Z', started_at) AS hour, COUNT(*) AS count FROM site_visits WHERE started_at >= ? GROUP BY hour ORDER BY hour").bind(day),
  ]);
  return reply({ metrics: metrics.results[0], events: feed.results, activity: activity.results, generatedAt: now.toISOString(), activeWindowSeconds: 90, notificationEmailConfigured: false });
}

export async function ownerPhoto(id, env) {
  const row = await env.DB.prepare('SELECT object_key FROM truck_sightings WHERE id = ?').bind(id).first();
  if (!row) return reply({ error: 'Photo not found.' }, 404);
  const object = await env.BUCKET.get(row.object_key);
  if (!object) return reply({ error: 'Photo not found.' }, 404);
  return new Response(object.body, { headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline', ...privateHeaders } });
}

export async function exportContacts(request, env) {
  const intent = new URL(request.url).searchParams.get('intent') === 'truck' ? 'truck' : 'follow';
  const result = await env.DB.prepare('SELECT contact_type, contact_value, created_at, consent FROM truck_requests WHERE intent = ? ORDER BY created_at DESC LIMIT 10000').bind(intent).all();
  const cell = (value) => {
    const text = String(value ?? '');
    return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const rows = [['method', 'contact', 'signed_up_at', 'permission'], ...result.results.map((row) => [row.contact_type, row.contact_value, row.created_at, row.consent])];
  return new Response('\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ittybitty-${intent === 'follow' ? 'followers' : 'truck-requests'}.csv"`, ...privateHeaders } });
}
