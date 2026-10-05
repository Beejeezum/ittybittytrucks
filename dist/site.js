'use strict';

const menuButton = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
const page = document.body.dataset.page;
const active = document.querySelector('[data-nav="' + (page === 'sambar' ? 'trucks' : page) + '"]');
if (active) active.setAttribute('aria-current', 'page');
if (menuButton && nav) {
  const closeMenu = () => { menuButton.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
}

const form = document.getElementById('wish-form');
if (form) {
  const result = document.getElementById('wish-result');
  const summary = document.getElementById('wish-summary');
  const status = document.getElementById('copy-status');
  const isSambar = new URLSearchParams(window.location.search).get('like') === 'teal-sambar';
  const reference = document.getElementById('reference-note');
  if (isSambar) reference.hidden = false;
  let draft = '';
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const clean = key => String(data.get(key) || '').trim();
    const features = data.getAll('must').join(', ') || 'Open to ideas';
    const lines = [
      'MY ITTY BITTY TRUCK WISH LIST', '',
      'Name: ' + clean('name'), 'Email: ' + clean('email'),
      'Location: ' + clean('location'), 'Total budget: ' + clean('budget'),
      'Use: ' + (clean('use') || 'Still figuring it out'),
      'Preferences: ' + features, 'Timing: ' + clean('timing')
    ];
    if (isSambar) lines.push('Inspired by: Bruce’s turquoise Subaru Sambar');
    if (clean('notes')) lines.push('', 'A little more:', clean('notes'));
    draft = lines.join('\n');
    summary.textContent = draft;
    status.textContent = '';
    form.hidden = true;
    result.hidden = false;
    if (document.body.dataset.emailReady === 'true') {
      const emailLink = document.getElementById('email-wish');
      emailLink.href = 'mailto:' + document.body.dataset.email + '?subject=' + encodeURIComponent('My itty bitty truck wish list') + '&body=' + encodeURIComponent(draft);
      emailLink.hidden = false;
      document.getElementById('launch-note').textContent = 'Open an email draft to Bruce, review it, then send it from your email app. Nothing has been sent yet.';
    }
    result.focus({ preventScroll: true });
    result.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  document.getElementById('edit-wish').addEventListener('click', () => { result.hidden = true; form.hidden = false; document.getElementById('name').focus(); });
  document.getElementById('copy-wish').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(draft);
      status.textContent = 'Copied. Your little wish list is ready to keep.';
    } catch {
      const range = document.createRange(); range.selectNodeContents(summary);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Your wish list is selected. Use Copy on your device to keep it.';
    }
  });
}
