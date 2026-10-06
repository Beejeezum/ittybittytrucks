import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const html = (await readFile(path.join(root, 'src/landing.html'), 'utf8'))
  .replace('{{ROBOTS}}', config.indexable ? 'index, follow' : 'noindex, nofollow');

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'assets'), { recursive: true });
await writeFile(path.join(out, 'index.html'), html);
await cp(path.join(root, 'src/404.html'), path.join(out, '404.html'));
await cp(path.join(root, 'src/landing.css'), path.join(out, 'styles.css'));
await cp(path.join(root, 'src/landing.js'), path.join(out, 'site.js'));
await cp(path.join(root, 'src/dashboard.html'), path.join(out, 'dashboard.html'));
await cp(path.join(root, 'src/dashboard.css'), path.join(out, 'dashboard.css'));
for (const name of ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'itty-bitty-trucks-logo.png', 'social-share.png', 'kei-illustration.webp', 'truck-cutout.webp']) {
  await cp(path.join(root, 'assets', name), path.join(out, 'assets', name));
}
await cp(path.join(root, 'assets/favicon.ico'), path.join(out, 'favicon.ico'));
await cp(path.join(root, 'assets/site.webmanifest'), path.join(out, 'site.webmanifest'));
await build({
  entryPoints: [path.join(root, 'src/dashboard.js')],
  outfile: path.join(out, 'dashboard.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: false,
});
await writeFile(path.join(out, 'robots.txt'), config.indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
console.log('Built the Netlify landing page, private dashboard, and static assets.');
