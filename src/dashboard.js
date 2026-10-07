import { acceptInvite, AuthError, getUser, handleAuthCallback, login, logout } from '@netlify/identity';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const labels = { follow: 'Someone’s following along', truck: 'Someone wants a little truck', love: 'A little love came in', photo: 'Spotted in the wild', visit: 'Someone stopped by' };
const icons = { follow: '＋', truck: '↔', love: '♥', photo: '▧', visit: '·' };
const empty = { all: 'Your first hello will show up here.', follow: 'No signups yet. Your next follower will appear here.', truck: 'No truck inquiries yet.', love: 'No love yet. Give it a little time.', photo: 'No sightings yet. Photos will appear here privately.', visit: 'No visits recorded yet. Tracking starts with this launch.' };
let kind = 'all', timer, controller, signature = '', latestId, stopped = false, inviteToken = '';
const number = new Intl.NumberFormat();
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function when(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}
function setConnection(text, state = '') {
  $('#connection-label').textContent = text;
  $('#connection').className = `connection ${state}`;
}
function lock(status) {
  stopped = true; clearTimeout(timer); controller?.abort();
  $$('.stat strong').forEach((node) => { node.textContent = '—'; });
  $('#feed').replaceChildren(); $('#traffic-chart').replaceChildren();
  $('.stats').hidden = true; $('.traffic').hidden = true; $('.activity').hidden = true; $('.delivery-note').hidden = true;
  $('#auth-message').hidden = false;
  $('#signout').hidden = status !== 403;
  if (status === 403) {
    $('#auth-message>p').textContent = 'This account doesn’t have access. Sign in with Bruce’s owner account.';
    $('#auth-error').textContent = 'This sign-in is not the owner account.';
  }
  setConnection('Sign-in required');
}
function unlock() {
  stopped = false;
  $('#auth-message').hidden = true;
  $('#signout').hidden = false;
  $('.stats').hidden = false; $('.traffic').hidden = false; $('.activity').hidden = false; $('.delivery-note').hidden = false;
  $('#auth-error').textContent = '';
  refresh();
}
function renderChart(rows) {
  const totals = new Map(rows.map((row) => [new Date(row.hour).getTime(), row.count]));
  const lastHour = Math.floor(Date.now() / 3600000) * 3600000;
  const points = Array.from({ length: 24 }, (_, i) => ({ time: lastHour - (23 - i) * 3600000, count: totals.get(lastHour - (23 - i) * 3600000) || 0 }));
  const highest = Math.max(1, ...points.map((point) => point.count));
  const chart = $('#traffic-chart');
  chart.replaceChildren(...points.map((point, i) => {
    const bar = element('div', `hour-bar${i === 23 ? ' current' : ''}`);
    bar.style.height = `${Math.max(3, point.count / highest * 100)}%`;
    bar.title = `${clock.format(new Date(point.time))}: ${point.count} ${point.count === 1 ? 'visit' : 'visits'}`;
    return bar;
  }));
  chart.setAttribute('aria-label', points.map((point) => `${clock.format(new Date(point.time))}: ${point.count} visits`).join('; '));
  $('#chart-start').textContent = clock.format(new Date(points[0].time));
}
function renderEvent(event) {
  const row = element('article', 'event');
  const icon = element('span', `event-icon ${event.kind}`, icons[event.kind] || '·');
  icon.setAttribute('aria-hidden', 'true');
  const content = element('div', 'event-content');
  content.append(element('h3', 'event-title', labels[event.kind] || 'New activity'));
  let details = '';
  if (event.kind === 'follow' || event.kind === 'truck') details = event.contact_value;
  else if (event.kind === 'love') details = 'A hello from someone out there. ♡';
  else if (event.kind === 'photo') details = event.source ? 'Marketing permission recorded.' : 'Private upload; no marketing permission recorded.';
  else if (event.kind === 'visit') details = [event.contact_type === 'mobile' ? 'On a phone' : event.contact_type === 'tablet' ? 'On a tablet' : 'On a computer', event.source ? `from ${event.source}` : 'direct visit'].join(' · ');
  content.append(element('p', 'event-details', details));
  if (event.kind === 'photo') {
    const link = element('a', 'photo-link');
    link.href = `/api/dashboard/photos/${encodeURIComponent(event.id)}`; link.target = '_blank'; link.rel = 'noopener';
    const img = element('img'); img.src = link.href; img.alt = 'Truck sighting sent to Bruce'; img.loading = 'lazy';
    link.append(img); content.append(link);
  }
  const meta = element('div', 'event-meta');
  const time = element('time', '', when(event.created_at)); time.dateTime = event.created_at; time.title = new Date(event.created_at).toLocaleString();
  meta.append(time);
  if (event.kind === 'truck') {
    const link = element('a', 'reply-link', event.contact_type === 'phone' ? 'Text back' : 'Reply');
    link.href = event.contact_type === 'phone' ? `sms:${encodeURIComponent(event.contact_value)}` : `mailto:${encodeURIComponent(event.contact_value)}?subject=Your%20itty%20bitty%20truck`;
    meta.append(link);
  }
  row.append(icon, content, meta);
  return row;
}
function render(data) {
  for (const key of ['active', 'visits', 'love', 'followers', 'requests', 'photos']) $(`#stat-${key}`).textContent = number.format(data.metrics[key]);
  renderChart(data.activity);
  const nextSignature = kind + ':' + data.events.map((event) => event.id).join('|');
  if (signature !== nextSignature) {
    $('#feed').replaceChildren(...(data.events.length ? data.events.map(renderEvent) : [element('p', 'empty-state', empty[kind])]));
    if (latestId && data.events[0]?.id !== latestId) $('#feed-announcement').textContent = 'New activity has arrived.';
    latestId = data.events[0]?.id; signature = nextSignature;
  } else {
    $$('#feed time').forEach((time) => { time.textContent = when(time.dateTime); });
  }
  $('#updated-at').textContent = `Updated ${clock.format(new Date(data.generatedAt))} ET · refreshes every 5 seconds`;
  setConnection('Live · updates every 5s', 'live');
}
async function refresh() {
  clearTimeout(timer);
  if (stopped || document.hidden) return;
  controller?.abort(); controller = new AbortController();
  const currentController = controller;
  const requestedKind = kind;
  try {
    const response = await fetch(`/api/dashboard?kind=${encodeURIComponent(requestedKind)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    if (response.status === 401 || response.status === 403) return lock(response.status);
    if (!response.ok) throw new Error('Couldn’t refresh');
    const data = await response.json();
    if (kind === requestedKind) render(data);
  } catch (error) { if (error.name !== 'AbortError') setConnection('Connection paused · retrying', 'error'); }
  finally { if (controller === currentController && !stopped && !document.hidden) timer = setTimeout(refresh, 5000); }
}
$$('[data-kind]').forEach((button) => button.addEventListener('click', () => {
  kind = button.dataset.kind; latestId = null; $('#feed-announcement').textContent = '';
  $$('[data-kind]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  refresh();
}));
document.addEventListener('visibilitychange', () => {
  clearTimeout(timer);
  if (document.hidden) { controller?.abort(); setConnection('Paused while this tab is hidden'); }
  else refresh();
});

async function submitAuth() {
  const form = $('#auth-form');
  if (!form.reportValidity()) return;
  const email = $('#owner-email').value.trim();
  const password = $('#owner-password').value;
  const buttons = $$('#auth-form button');
  buttons.forEach((button) => { button.disabled = true; });
  $('#auth-error').textContent = inviteToken ? 'Activating your private sign-in…' : 'Signing you in…';
  try {
    if (inviteToken) await acceptInvite(inviteToken, password);
    else await login(email, password);
    inviteToken = '';
    unlock();
  } catch (error) {
    $('#auth-error').textContent = error instanceof AuthError ? error.message : 'That sign-in didn’t work. Try again.';
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

$('#auth-form').addEventListener('submit', (event) => { event.preventDefault(); submitAuth(); });
$('#signout').addEventListener('click', async () => {
  await logout();
  lock(401);
});

async function setupIdentity() {
  try {
    const callback = await handleAuthCallback();
    if (callback?.type === 'invite' && callback.token) {
      inviteToken = callback.token;
      lock(401);
      $('#auth-message h2').textContent = 'Choose your owner password.';
      $('#auth-message>p').textContent = 'This invitation is private to your owner account.';
      $('label[for="owner-email"]').hidden = true;
      $('#owner-email').hidden = true;
      $('#owner-email').required = false;
      $('#owner-password').autocomplete = 'new-password';
      $('#login-button').textContent = 'Activate owner sign-in';
      $('.auth-help').textContent = 'Use at least 8 characters. You’ll be signed in when the account is ready.';
      return;
    }
  } catch (error) { $('#auth-error').textContent = error instanceof AuthError ? error.message : 'That invitation link didn’t work.'; }
  const user = await getUser();
  if (user) unlock(); else lock(401);
}
setupIdentity();
