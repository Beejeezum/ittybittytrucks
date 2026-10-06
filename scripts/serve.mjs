import http from 'node:http';
import { fileURLToPath } from 'node:url';
import worker from '../dist/server/index.js';
import { createLocalEnv } from './local-env.mjs';
const { env } = await createLocalEnv(fileURLToPath(new URL('../.sites-runtime/local/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/__preview/mobile')) {
      const width = new URL(req.url, 'http://localhost').searchParams.get('width') === '360' ? 360 : 390;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><title>Mobile QA</title><style>body{margin:0;display:grid;place-items:start center;background:#dce1da}iframe{width:${width}px;height:844px;border:0;background:#faf8f1}</style><iframe src="/" title="Mobile landing page"></iframe>`); return;
    }
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: req, duplex: 'half' }) });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error.message); res.writeHead(500).end('Preview unavailable'); }
}).listen(port, '0.0.0.0', () => console.log('Truck preview ready on port ' + port));
