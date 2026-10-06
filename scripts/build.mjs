import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const html = (await readFile(path.join(root, 'src/landing.html'), 'utf8')).replace('{{ROBOTS}}', config.indexable ? 'index, follow' : 'noindex, nofollow');
const assets = {
  '/': { type: 'text/html; charset=utf-8', body: html },
  '/styles.css': { type: 'text/css; charset=utf-8', body: await readFile(path.join(root, 'src/landing.css'), 'utf8') },
  '/site.js': { type: 'text/javascript; charset=utf-8', body: await readFile(path.join(root, 'src/landing.js'), 'utf8') },
  '/assets/favicon.svg': { type: 'image/svg+xml', body: await readFile(path.join(root, 'assets/favicon.svg'), 'utf8') },
  '/assets/kei-illustration.webp': { type: 'image/webp', body: (await readFile(path.join(root, 'assets/kei-illustration.webp'))).toString('base64'), base64: true },
  '/dashboard': { type: 'text/html; charset=utf-8', body: await readFile(path.join(root, 'src/dashboard.html'), 'utf8') },
  '/dashboard.css': { type: 'text/css; charset=utf-8', body: await readFile(path.join(root, 'src/dashboard.css'), 'utf8') },
  '/dashboard.js': { type: 'text/javascript; charset=utf-8', body: await readFile(path.join(root, 'src/dashboard.js'), 'utf8') },
  '/assets/truck-cutout.webp': { type: 'image/webp', body: (await readFile(path.join(root, 'assets/truck-cutout.webp'))).toString('base64'), base64: true },
  '/robots.txt': { type: 'text/plain; charset=utf-8', body: config.indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n' },
};
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'server'), { recursive: true });
await mkdir(path.join(out, '.openai'), { recursive: true });
await writeFile(path.join(out, 'server/site-assets.js'), `export const assets = ${JSON.stringify(assets)};\n`);
await cp(path.join(root, 'worker/index.js'), path.join(out, 'server/index.js'));
await cp(path.join(root, 'worker/dashboard.js'), path.join(out, 'server/dashboard.js'));
await cp(path.join(root, '.openai/hosting.json'), path.join(out, '.openai/hosting.json'));
await cp(path.join(root, 'drizzle'), path.join(out, '.openai/drizzle'), { recursive: true });
console.log('Built one mobile landing page, Worker API, and Drizzle migrations.');
