import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const template = await readFile(path.join(root, 'src/template.html'), 'utf8');
const pages = [
  ['home', '', 'Itty Bitty Trucks — You found one.', 'Meet the little Japanese trucks making ordinary errands more interesting. Start with Bruce’s turquoise Subaru Sambar.'],
  ['trucks', 'trucks', 'Meet the trucks — Itty Bitty Trucks', 'Meet Bruce’s tiny turquoise Subaru Sambar, check available trucks, or put together a wish list for your own.'],
  ['sambar', 'trucks/teal-sambar', 'Oh, hey. You found me. — The Tiny Teal Truck', 'You found Bruce’s turquoise 2000 Subaru Sambar TT2. Get to know this little truck and find out about owning one.'],
  ['guide', 'tiny-truck-101', 'Tiny truck 101 — Itty Bitty Trucks', 'A friendly introduction to Japanese kei trucks, from their tiny proportions to the questions to ask before buying one.'],
  ['request', 'find-me-one', 'Find your itty bitty truck', 'Put together a wish list for a tiny truck: budget, location, how you will use it, and the things you care about.'],
  ['404', '404', 'A little lost? — Itty Bitty Trucks', 'Let’s get you back to the little trucks.']
];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [key, route, title, description] of pages) {
  const body = await readFile(path.join(root, 'src/pages/' + key + '.html'), 'utf8');
  const values = {
    CONTENT: body, TITLE: title, DESCRIPTION: description,
    CANONICAL: config.url + (route ? '/' + route + '/' : '/'),
    ROBOTS: config.indexable ? 'index, follow' : 'noindex, nofollow', PAGE: key,
    EMAIL_READY: String(config.emailReady), EMAIL: config.email,
    YEAR: String(new Date().getFullYear())
  };
  let html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => values[k] ?? '');
  const dir = path.join(out, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
  if (key === '404') await writeFile(path.join(out, '404.html'), html);
}
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
await cp(path.join(root, 'src/styles.css'), path.join(out, 'styles.css'));
await cp(path.join(root, 'src/site.js'), path.join(out, 'site.js'));
const redirect = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=/trucks/teal-sambar/"><link rel="canonical" href="' + config.url + '/trucks/teal-sambar/"><title>Meet the tiny teal truck</title><a href="/trucks/teal-sambar/">Meet the tiny teal truck</a></html>';
await mkdir(path.join(out, 'hi/teal'), { recursive: true });
await writeFile(path.join(out, 'hi/teal/index.html'), redirect);
await writeFile(path.join(out, '_redirects'), '/hi/teal /trucks/teal-sambar/ 302\n/hi/teal/ /trucks/teal-sambar/ 302\n');
await writeFile(path.join(out, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');
await writeFile(path.join(out, 'robots.txt'), config.indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
console.log('Built ' + pages.length + ' pages and the permanent /hi/teal QR route.');
