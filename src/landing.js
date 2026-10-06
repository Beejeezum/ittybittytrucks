const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function requestID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'That didn’t go through. Please try again.');
  return result;
}
let helloPromise;
function hello() {
  return helloPromise ||= api('/api/hello').catch((error) => { helloPromise = null; throw error; });
}
async function post(path, payload) {
  await hello();
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
function loveSaved() {
  $('#love-button').setAttribute('aria-pressed', 'true');
  $('#love-label').textContent = 'Love received';
  $('#love-button .heart').textContent = '♥';
}
hello().then((state) => { if (state.loved) loveSaved(); }).catch(() => {});
$('#love-button').addEventListener('click', async () => {
  const button = $('#love-button');
  if (button.getAttribute('aria-pressed') === 'true') return;
  button.disabled = true;
  $('#love-label').textContent = 'Sending…';
  $('#love-status').textContent = '';
  try { await post('/api/signal', { kind: 'love', value: 'yes' }); loveSaved(); $('#love-status').textContent = 'Right back at you. ♡'; }
  catch (error) { $('#love-label').textContent = 'Send a little love'; $('#love-status').textContent = error.message; }
  finally { button.disabled = false; }
});

let sheetTrigger;
function openSheet(id, trigger) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  $$('dialog[open]').forEach((open) => open.close());
  sheetTrigger = trigger || document.activeElement;
  dialog.showModal();
  document.body.classList.add('sheet-open');
  dialog.scrollTop = 0;
}
$$('[data-open]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.open, b)));
$$('[data-switch]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.switch, sheetTrigger)));
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (!$('dialog[open]')) { document.body.classList.remove('sheet-open'); sheetTrigger?.focus({ preventScroll: true }); }
  });
});
function sizeViewport() { document.documentElement.style.setProperty('--visual-height', `${window.visualViewport?.height || innerHeight}px`); }
window.visualViewport?.addEventListener('resize', sizeViewport);
sizeViewport();

let contactMethod = 'email';
const drafts = { email: '', phone: '' };
$$('[data-method]').forEach((button) => button.addEventListener('click', () => {
  const input = $('#truck-contact');
  drafts[contactMethod] = input.value;
  contactMethod = button.dataset.method;
  $$('[data-method]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  input.type = input.inputMode = input.autocomplete = contactMethod === 'email' ? 'email' : 'tel';
  input.placeholder = contactMethod === 'email' ? 'you@example.com' : '(555) 123-4567';
  input.maxLength = contactMethod === 'email' ? 254 : 30;
  input.value = drafts[contactMethod];
  input.removeAttribute('aria-invalid');
  $('#truck-contact-label').textContent = contactMethod === 'email' ? 'Your email' : 'Your mobile number';
  $('#truck-error').textContent = '';
}));
for (const intent of ['follow', 'truck']) {
  const form = $(`#${intent}-form`);
  const input = $(intent === 'follow' ? '#follow-email' : '#truck-contact');
  const error = $(`#${intent}-error`);
  const button = form.querySelector('[type=submit]');
  const label = button.innerHTML;
  let requestId = requestID();
  input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const method = intent === 'follow' ? 'email' : contactMethod;
    input.value = input.value.trim();
    const digits = input.value.replace(/\D/g, '');
    if (!input.validity.valid || (method === 'phone' && (digits.length < 8 || digits.length > 15))) {
      error.textContent = method === 'email' ? 'Pop in a valid email address.' : 'Check that number, including the area code.';
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    button.disabled = true; button.textContent = 'Saving…'; error.textContent = '';
    try {
      await post('/api/contact', { intent, method, contact: input.value, website: $(`#${intent}-website`).value, requestId });
      input.value = ''; drafts.email = ''; drafts.phone = '';
      $(intent === 'follow' ? '#follow-content' : '#truck-form-content').hidden = true;
      $(`#${intent}-success`).hidden = false;
      $(`#${intent}-success`).focus({ preventScroll: true });
      requestId = requestID();
    } catch (failure) { error.textContent = failure.message; }
    finally { button.disabled = false; button.innerHTML = label; }
  });
}

let photoBlob, previewUrl, photoRequestId;
$('#sighting-photo').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  photoBlob = null; $('#photo-send').disabled = true; $('#photo-error').textContent = '';
  $('#photo-prompt').hidden = false; $('#photo-prompt').textContent = 'Getting your photo ready…'; $('#photo-preview').hidden = true;
  try {
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
    const sourceUrl = URL.createObjectURL(file);
    const picture = new Image();
    try {
      picture.src = sourceUrl; await picture.decode();
      const scale = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      photoBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    } finally { URL.revokeObjectURL(sourceUrl); }
    if (!photoBlob || photoBlob.size > 2 * 1024 * 1024) throw new Error('Try a smaller photo.');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(photoBlob); $('#photo-preview').src = previewUrl; $('#photo-preview').hidden = false; $('#photo-prompt').hidden = true;
    $('#photo-send').disabled = false; photoRequestId = requestID();
  } catch (error) { photoBlob = null; $('#photo-prompt').textContent = 'Choose a photo'; $('#photo-error').textContent = 'Couldn’t open that photo. Try a JPEG or PNG under 20 MB.'; }
});
$('#photo-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!photoBlob) return;
  const button = $('#photo-send'); button.disabled = true; $('#sighting-photo').disabled = true; button.textContent = 'Sending…'; $('#photo-error').textContent = '';
  try {
    await hello();
    await api('/api/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Request-ID': photoRequestId }, body: photoBlob });
    $('#photo-form-content').hidden = true; $('#photo-success').hidden = false; $('#photo-success').focus({ preventScroll: true });
    photoBlob = null; URL.revokeObjectURL(previewUrl); $('#sighting-photo').value = '';
  } catch (error) { $('#photo-error').textContent = error.message; }
  finally { button.disabled = !photoBlob; $('#sighting-photo').disabled = false; button.textContent = 'Send photo'; }
});
if (location.hash === '#truck') openSheet('truck-sheet', $('[data-open="truck-sheet"]'));
if (location.hash === '#about') openSheet('info-sheet', $('[data-open="info-sheet"]'));
