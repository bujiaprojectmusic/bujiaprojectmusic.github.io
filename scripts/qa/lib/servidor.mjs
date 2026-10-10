// Servidor estático mínimo para dist/ (gzip para texto, como GitHub Pages).
// Lo usan scripts/qa/lib/axe.mjs y scripts/check-budget.mjs.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json',
};
const COMPRIMIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.webmanifest']);

export function resolverArchivo(dist, urlPath) {
  const limpio = decodeURIComponent(urlPath.split('?')[0].split('#')[0]).replace(/\/+$/, '');
  const candidatos = [path.join(dist, limpio), path.join(dist, limpio, 'index.html'), path.join(dist, `${limpio}.html`)];
  for (const c of candidatos) {
    if (!c.startsWith(dist)) continue;
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Levanta el servidor en 127.0.0.1 (puerto libre). Devuelve { base, cerrar }. */
export function servirDist(dist) {
  const DIST = path.resolve(dist);
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = resolverArchivo(DIST, req.url ?? '/');
      if (!f) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('404');
        return;
      }
      const ext = path.extname(f).toLowerCase();
      const cuerpo = fs.readFileSync(f);
      const cab = { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
      if (COMPRIMIBLE.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
        const gz = zlib.gzipSync(cuerpo, { level: 6 });
        res.writeHead(200, { ...cab, 'content-encoding': 'gzip', 'content-length': gz.length });
        res.end(gz);
      } else {
        res.writeHead(200, { ...cab, 'content-length': cuerpo.length });
        res.end(cuerpo);
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${srv.address().port}`, cerrar: () => srv.close() }));
  });
}
