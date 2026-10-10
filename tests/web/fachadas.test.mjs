// Test de las fachadas de video y playlist (issue #17, criterios 7 y 8)
// con Playwright sobre dist/ ya construido (npm run build):
//  - /fanzine/kit/fachadas tiene 2 videos + 1 playlist;
//  - antes del clic: 0 peticiones a youtube.com, youtube-nocookie.com,
//    ytimg.com, spotify.com y bandcamp.com;
//  - después del clic: aparece el <iframe> (youtube-nocookie, autoplay=1);
//  - con JavaScript desactivado cada fachada es un <a href> al servicio;
//  - el script de fachada no está en páginas sin video.
// Corre: npm run test:web  (Chromium de Playwright; PW_CHROMIUM=/ruta si hace falta).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { servirDist } from '../../scripts/qa/lib/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(RAIZ, 'dist');
const DOMINIOS = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|spotify\.com|scdn\.co|bandcamp\.com|bcbits\.com)$/;
const esExterno = (url) => DOMINIOS.test(new URL(url).hostname);

let servidor, base, browser;
before(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'fanzine', 'kit', 'fachadas', 'index.html')), 'falta dist/fanzine/kit/fachadas/index.html: corré npm run build');
  servidor = await servirDist(DIST);
  base = servidor.base;
  browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); servidor?.cerrar(); });

/** Página con registro de peticiones (del contexto entero: también las pestañas que abra un enlace
 *  target=_blank) y bloqueo de los dominios externos (la red del CI no importa). */
async function abrir(ctx) {
  const externas = [];
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (esExterno(url)) { externas.push(url); return route.abort(); }
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/fanzine/kit/fachadas`, { waitUntil: 'networkidle' });
  return { page, externas };
}

test('fachadas: 0 peticiones a YouTube/Spotify/Bandcamp antes del clic y iframe después', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, externas } = await abrir(ctx);
  const fachadas = page.locator('a.fz-fachada[data-embed]');
  assert.equal(await fachadas.count(), 3, '2 videos + 1 playlist');
  assert.equal(await page.locator('iframe').count(), 0, 'sin iframes al cargar');
  assert.deepEqual(externas, [], `peticiones externas antes del clic: ${externas.join(', ')}`);
  console.log(`  antes del clic: ${externas.length} peticiones a youtube/spotify/bandcamp; ${await fachadas.count()} fachadas; 0 iframes`);
  await fachadas.first().click();
  const iframe = page.locator('iframe').first();
  await iframe.waitFor({ state: 'attached' });
  const src = await iframe.getAttribute('src');
  assert.match(src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/C1vfbwwdtOQ\?autoplay=1$/);
  assert.ok(externas.some((u) => u.includes('youtube-nocookie.com/embed/')), 'tras el clic sí se pide el iframe');
  console.log(`  después del clic: iframe src=${src}; peticiones externas: ${externas.length}`);
  await ctx.close();
});

test('fachadas: sin JavaScript cada una es un enlace al video o playlist', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const { page, externas } = await abrir(ctx);
  const hrefs = await page.locator('a.fz-fachada').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert.deepEqual(hrefs, [
    'https://www.youtube.com/watch?v=C1vfbwwdtOQ',
    'https://www.youtube.com/watch?v=C1vfbwwdtOQ',
    'https://www.youtube.com/playlist?list=PLzMaYoBMVrDm6n8BMuAVIctRy7GFBR5Ef',
  ]);
  // El clic navega al servicio (bloqueado acá) en vez de meter un iframe.
  const [req] = await Promise.all([ctx.waitForEvent('request', (r) => esExterno(r.url())), page.locator('a.fz-fachada').first().click()]);
  assert.match(req.url(), /youtube\.com\/watch\?v=C1vfbwwdtOQ/);
  assert.deepEqual(externas.filter((u) => !/youtube\.com\/watch/.test(u)), []);
  console.log(`  sin JS: ${hrefs.length} enlaces → ${hrefs.join(' | ')}; el clic navega a ${req.url()}`);
  await ctx.close();
});

/** JS del script de fachada en una página de dist: sigue los `import "./x.js"` de los módulos hoisted de Astro. */
function scriptsFachada(html) {
  const vistos = new Set();
  let bytes = 0;
  const archivos = [];
  const leer = (archivo) => {
    if (vistos.has(archivo)) return;
    vistos.add(archivo);
    const js = fs.readFileSync(archivo, 'utf8');
    bytes += zlib.gzipSync(js).length;
    archivos.push(path.relative(DIST, archivo));
    for (const m of js.matchAll(/import\s*"(\.\/[^"]+)"/g)) leer(path.join(path.dirname(archivo), m[1]));
  };
  for (const [, attrs, cuerpo] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attrs.match(/src="([^"]+)"/)?.[1];
    if (src) leer(path.join(DIST, src.replace(/^\//, '')));
    else if (/fz-fachada/.test(cuerpo)) { bytes += zlib.gzipSync(cuerpo).length; archivos.push('inline'); }
  }
  return { bytes, archivos, conFachada: archivos.some((a) => a === 'inline' || /fz-fachada/.test(fs.readFileSync(path.join(DIST, a), 'utf8'))) };
}

test('fachadas: el script pesa ≤ 1 KB gzip y no está en páginas sin video', () => {
  const limite = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'components', 'fanzine', 'registro.json'), 'utf8')).limites.script_fachada_gzip_kb * 1024;
  const con = scriptsFachada(fs.readFileSync(path.join(DIST, 'fanzine', 'kit', 'fachadas', 'index.html'), 'utf8'));
  assert.ok(con.conFachada, 'la página fixture no trae el script de fachada');
  assert.ok(con.bytes <= limite, `script de fachada: ${con.bytes} B gzip (> ${limite})`);
  const sinVideo = ['fanzine/index.html', 'fanzine/colabora/index.html', 'volumenes/index.html'].filter((f) => fs.existsSync(path.join(DIST, f)));
  for (const f of sinVideo) {
    const sin = scriptsFachada(fs.readFileSync(path.join(DIST, f), 'utf8'));
    assert.ok(!sin.conFachada, `${f} trae el script de fachada`);
    assert.doesNotMatch(fs.readFileSync(path.join(DIST, f), 'utf8'), /fz-fachada/);
  }
  console.log(`  script de fachada: ${con.bytes} B gzip (${con.archivos.join(' + ')}); ausente en ${sinVideo.join(', ')}`);
});
