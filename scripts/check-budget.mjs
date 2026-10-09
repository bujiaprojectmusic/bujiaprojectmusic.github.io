#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Presupuesto de datos del fanzine (issue #8): npm run check:budget
//
// Mide, con Chromium (Playwright) en viewport de celular y caché vacía,
// cuántos bytes transfiere cada página:
//   - primera vista: hasta `load` + red inactiva, sin hacer scroll;
//   - página completa: haciendo scroll hasta el final (dispara los lazy);
//   - desglose por tipo (HTML, CSS, JS, fuentes, imágenes, otros) con
//     encodedDataLength de CDP (bytes en la red, comprimidos);
//   - peticiones a dominios de terceros (informativo, para #17).
// Los límites y las páginas viven SÓLO en budget.json. Las páginas
// "fallan" tumban el proceso (exit 1) si rebasan; las "informativas"
// sólo avisan. Los PDF (*.pdf) no se cargan al navegar, así que no cuentan.
//
// Sirve dist/ con su propio servidor estático con gzip para texto (como
// GitHub Pages) para que la medida sea la transferencia comprimida. Con
// --url mide contra un servidor ya levantado (p. ej. npx astro preview,
// que NO comprime: los números de HTML/CSS/JS salen más altos).
//
// Uso: node scripts/check-budget.mjs [--dist dist] [--url http://localhost:4321]
//                                    [--json reporte.json] [--md resumen.md]
//                                    [--paginas /fanzine,/fanzine/vol-00]
// Si existe $GITHUB_STEP_SUMMARY, el resumen en Markdown se agrega ahí.
// Chromium: el de Playwright (npx playwright install chromium) o el que
// diga $PW_CHROMIUM (ruta al ejecutable).
// ─────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const t0 = Date.now();
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = path.resolve(opt('--dist', 'dist'));
const URL_BASE = opt('--url', null);
const JSON_OUT = opt('--json', null);
const MD_OUT = opt('--md', null);
const SOLO = opt('--paginas', null)?.split(',').map((s) => s.trim()).filter(Boolean);

const budget = JSON.parse(fs.readFileSync(path.resolve('budget.json'), 'utf8'));
const LIM = budget.limites_kb;
const VP = budget.viewport;
const TOP = budget.recursos_mas_pesados ?? 5;

// ── Servidor estático con gzip (como GitHub Pages) ────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json',
};
const COMPRIMIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.webmanifest']);

function resolverArchivo(urlPath) {
  const limpio = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '');
  const candidatos = [path.join(DIST, limpio), path.join(DIST, limpio, 'index.html'), path.join(DIST, `${limpio}.html`)];
  for (const c of candidatos) {
    if (!c.startsWith(DIST)) continue;
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function servir() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = resolverArchivo(req.url ?? '/');
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
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── Páginas a medir ───────────────────────────────────────────────────────
function esRedireccion(archivo) {
  const s = fs.readFileSync(archivo, 'utf8').slice(0, 2000);
  return /http-equiv="refresh"/i.test(s);
}

function expandir(patrones) {
  const out = [];
  for (const p of patrones) {
    if (!p.includes('*')) {
      out.push(p);
      continue;
    }
    // Sólo se soporta "*" en el último tramo: /fanzine/vol-*
    const dir = path.join(DIST, path.dirname(p));
    const re = new RegExp(`^${path.basename(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory() || !re.test(e.name)) continue;
      const idx = path.join(dir, e.name, 'index.html');
      if (!fs.existsSync(idx) || esRedireccion(idx)) continue;
      out.push(path.posix.join(path.dirname(p), e.name));
    }
  }
  return out;
}

// ── Medición de una página ────────────────────────────────────────────────
const TIPO = (t) => ({ Document: 'html', Stylesheet: 'css', Script: 'js', Font: 'fuentes', Image: 'imagenes', Media: 'media' })[t] ?? 'otros';

async function medir(browser, base, ruta) {
  const context = await browser.newContext({
    viewport: { width: VP.ancho, height: VP.alto },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 jirafa-budget',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const recursos = new Map();
  cdp.on('Network.requestWillBeSent', (e) => {
    recursos.set(e.requestId, { url: e.request.url, tipo: TIPO(e.type), bytes: 0, fase: 'primera', terminado: false });
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = recursos.get(e.requestId);
    if (r) {
      r.tipo = TIPO(e.type);
      r.estado = e.response.status;
      r.mime = e.response.mimeType;
    }
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = recursos.get(e.requestId);
    if (r) {
      r.bytes = e.encodedDataLength;
      r.terminado = true;
    }
  });
  cdp.on('Network.loadingFailed', (e) => {
    const r = recursos.get(e.requestId);
    if (r) r.fallo = e.errorText;
  });

  let ultimoEvento = Date.now();
  for (const ev of ['Network.requestWillBeSent', 'Network.loadingFinished', 'Network.loadingFailed']) cdp.on(ev, () => (ultimoEvento = Date.now()));
  // Red quieta: `quieto` ms sin eventos de red, o `maximo` ms en total. No
  // usa networkidle de Playwright porque un embed que nunca responde (p. ej.
  // un mapa o un video bloqueado por la red) lo dejaría colgado.
  const redQuieta = async (quieto = 800, maximo = 10_000) => {
    const inicio = Date.now();
    while (Date.now() - inicio < maximo) {
      if (Date.now() - ultimoEvento >= quieto) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };

  const url = base + ruta;
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  if (!resp || resp.status() >= 400) throw new Error(`${ruta}: respondió ${resp?.status() ?? 'nada'}`);
  const quietaPrimera = await redQuieta();
  const marcarFase = (fase) => {
    for (const r of recursos.values()) if (r.fase === undefined) r.fase = fase;
  };
  const primera = sumar(recursos, () => true);
  // Scroll hasta el final para disparar lazy / fondos / embeds.
  const faseAntes = new Set(recursos.keys());
  let ultimo = -1;
  for (let i = 0; i < 400; i++) {
    const y = await page.evaluate(() => {
      window.scrollBy(0, Math.round(window.innerHeight * 0.8));
      return window.scrollY;
    });
    await page.waitForTimeout(120);
    if (y === ultimo) break;
    ultimo = y;
  }
  const quietaCompleta = await redQuieta(1000, 15_000);
  for (const [id, r] of recursos) if (!faseAntes.has(id)) r.fase = 'scroll';
  marcarFase('primera');
  const completa = sumar(recursos, () => true);
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const origen = new URL(url).host;
  const terceros = [...recursos.values()].filter((r) => {
    try {
      return new URL(r.url).host !== origen && !r.url.startsWith('data:');
    } catch {
      return false;
    }
  });
  const dominios = [...new Set(terceros.map((r) => new URL(r.url).host))];
  const lista = [...recursos.values()].filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  await context.close();
  return {
    ruta,
    primera,
    completa,
    alto_px: alto,
    peticiones: recursos.size,
    terceros: { n: terceros.length, dominios },
    pesados: lista.slice(0, TOP).map((r) => ({ url: r.url.replace(base, ''), bytes: r.bytes, tipo: r.tipo, fase: r.fase })),
    fallidos: [...recursos.values()].filter((r) => r.fallo || (r.estado ?? 200) >= 400).map((r) => ({ url: r.url.replace(base, ''), estado: r.estado, fallo: r.fallo })),
    pendientes: [...recursos.values()].filter((r) => !r.terminado && !r.fallo).map((r) => r.url.replace(base, '')),
    red_quieta: quietaPrimera && quietaCompleta,
  };
}

function sumar(recursos, filtro) {
  const out = { total: 0, html: 0, css: 0, js: 0, fuentes: 0, imagenes: 0, media: 0, otros: 0 };
  for (const r of recursos.values()) {
    if (!filtro(r)) continue;
    if (/\.pdf(\?|$)/i.test(r.url)) continue;
    out.total += r.bytes;
    out[r.tipo] = (out[r.tipo] ?? 0) + r.bytes;
  }
  return out;
}

// ── Evaluación contra budget.json ─────────────────────────────────────────
const kb = (b) => b / 1024;
const fmt = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);
const fmtLim = (k) => (k >= 1024 ? `${(k / 1024).toFixed(k % 1024 ? 1 : 0)} MB` : `${k} KB`);

function evaluar(m, esVolumen) {
  const filas = [
    { metrica: 'Primera vista (sin scroll)', bytes: m.primera.total, limite: LIM.primera_vista, clave: 'primera_vista' },
    { metrica: 'HTML', bytes: m.completa.html, limite: LIM.html, clave: 'html' },
    { metrica: 'CSS', bytes: m.completa.css, limite: LIM.css, clave: 'css' },
    { metrica: 'Fuentes', bytes: m.completa.fuentes, limite: LIM.fuentes, clave: 'fuentes' },
    { metrica: 'JS total', bytes: m.completa.js, limite: LIM.js, clave: 'js' },
    { metrica: esVolumen ? 'Volumen completo (scroll al final)' : 'Página completa (scroll al final)', bytes: m.completa.total, limite: LIM.pagina_completa, clave: 'pagina_completa' },
  ];
  for (const f of filas) f.ok = kb(f.bytes) <= f.limite;
  return filas;
}

function tablaMd(m, filas, modo) {
  const icono = (ok) => (ok ? '✅' : modo === 'falla' ? '❌' : '⚠️');
  const l = [];
  l.push(`### \`${m.ruta}\` ${modo === 'falla' ? '' : '(informativa: no tumba el CI)'}`);
  l.push('');
  l.push('| Métrica | Valor | Límite | Estado |');
  l.push('|---|---:|---:|:-:|');
  for (const f of filas) l.push(`| ${f.metrica} | ${fmt(f.bytes)} | ≤ ${fmtLim(f.limite)} | ${icono(f.ok)} |`);
  l.push('');
  l.push(`Imágenes: ${fmt(m.completa.imagenes)} (primera vista ${fmt(m.primera.imagenes)}) · peticiones: ${m.peticiones} · a terceros: **${m.terceros.n}**${m.terceros.dominios.length ? ` (${m.terceros.dominios.join(', ')})` : ''} · alto de página: ${m.alto_px} px`);
  l.push('');
  l.push(`Recursos más pesados (${m.pesados.length}):`);
  for (const r of m.pesados) l.push(`- ${fmt(r.bytes)} · ${r.tipo} · \`${r.url}\`${r.fase === 'scroll' ? ' (cargó al hacer scroll)' : ''}`);
  if (m.fallidos.length) {
    l.push('');
    l.push(`Peticiones fallidas (${m.fallidos.length}): ${m.fallidos.map((f) => `\`${f.url}\` (${f.estado ?? f.fallo})`).join(', ')}`);
  }
  if (m.pendientes.length) {
    l.push('');
    l.push(`Peticiones que no terminaron de cargar (no cuentan bytes): ${m.pendientes.map((u) => `\`${u}\``).join(', ')}`);
  }
  if (!m.red_quieta) {
    l.push('');
    l.push('⚠️ La red no llegó a quedar quieta dentro del tiempo máximo: la medida puede quedarse corta.');
  }
  l.push('');
  return l.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  let base = URL_BASE;
  let srv = null;
  if (!base) {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      console.error(`No existe ${DIST}/index.html: corré npm run build primero (o pasá --url).`);
      process.exit(2);
    }
    srv = await servir();
    base = `http://127.0.0.1:${srv.address().port}`;
  }
  const fallan = expandir(budget.paginas.fallan);
  const informativas = expandir(budget.paginas.informativas);
  const lista = [...fallan.map((r) => ({ ruta: r, modo: 'falla' })), ...informativas.map((r) => ({ ruta: r, modo: 'info' }))].filter(
    (p) => !SOLO || SOLO.includes(p.ruta),
  );
  if (!lista.length) {
    console.error('No hay páginas que medir (¿budget.json o --paginas?).');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox'],
  });
  const md = [];
  const reporte = { generado: new Date().toISOString(), base, comprimido: !URL_BASE, viewport: VP, limites_kb: LIM, paginas: [] };
  md.push(`## Presupuesto de datos (budget.json) — ${VP.ancho}×${VP.alto}, caché vacía${URL_BASE ? ', SIN comprimir (--url)' : ', gzip como GitHub Pages'}`);
  md.push('');
  md.push('| Página | Primera vista | HTML | CSS | Fuentes | JS | Completa | Terceros | Estado |');
  md.push('|---|---:|---:|---:|---:|---:|---:|---:|:-:|');
  const detalles = [];
  const errores = [];
  const avisos = [];
  for (const p of lista) {
    process.stdout.write(`→ ${p.ruta} … `);
    let m;
    try {
      m = await medir(browser, base, p.ruta);
    } catch (e) {
      process.stdout.write('ERROR\n');
      (p.modo === 'falla' ? errores : avisos).push(`${p.ruta}: no se pudo medir (${e.message.split('\n')[0]})`);
      md.push(`| \`${p.ruta}\`${p.modo === 'info' ? ' (info)' : ''} | — | — | — | — | — | — | — | ${p.modo === 'falla' ? '❌' : '⚠️'} no cargó |`);
      continue;
    }
    const filas = evaluar(m, /^\/fanzine\/vol-/.test(p.ruta));
    const malas = filas.filter((f) => !f.ok);
    const estado = malas.length ? (p.modo === 'falla' ? '❌' : '⚠️') : '✅';
    process.stdout.write(`${estado} primera ${fmt(m.primera.total)} · completa ${fmt(m.completa.total)} · terceros ${m.terceros.n}\n`);
    const c = (clave) => {
      const f = filas.find((x) => x.clave === clave);
      return `${fmt(f.bytes)}${f.ok ? '' : ' ‼'}`;
    };
    md.push(`| \`${p.ruta}\`${p.modo === 'info' ? ' (info)' : ''} | ${c('primera_vista')} | ${c('html')} | ${c('css')} | ${c('fuentes')} | ${c('js')} | ${c('pagina_completa')} | ${m.terceros.n} | ${estado} |`);
    detalles.push(tablaMd(m, filas, p.modo));
    reporte.paginas.push({ ...m, modo: p.modo, metricas: filas.map(({ metrica, bytes, limite, ok, clave }) => ({ clave, metrica, bytes, limite_kb: limite, ok })) });
    for (const f of malas) {
      const peor = m.pesados[0];
      const msg = `${p.ruta}: ${f.metrica} = ${fmt(f.bytes)} > límite ${fmtLim(f.limite)} (budget.json → limites_kb.${f.clave}). Recurso más pesado: ${peor ? `${peor.url} (${fmt(peor.bytes)}, ${peor.tipo})` : '—'}`;
      (p.modo === 'falla' ? errores : avisos).push(msg);
    }
  }
  await browser.close();
  if (srv) srv.close();
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  md.push('');
  md.push(...detalles);
  if (avisos.length) {
    md.push('### ⚠️ Avisos (páginas informativas)');
    md.push('');
    for (const a of avisos) md.push(`- ${a}`);
    md.push('');
  }
  if (errores.length) {
    md.push('### ❌ Fuera de presupuesto');
    md.push('');
    for (const e of errores) md.push(`- ${e}`);
    md.push('');
  }
  md.push(`Tiempo del chequeo: ${seg} s · Chromium ${browser.version()} · playwright ${JSON.parse(fs.readFileSync(new URL('../node_modules/playwright/package.json', import.meta.url), 'utf8')).version}`);
  const texto = md.join('\n') + '\n';
  console.log('\n' + texto);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto);
  if (MD_OUT) fs.writeFileSync(MD_OUT, texto);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ ...reporte, segundos: Number(seg), errores, avisos }, null, 2));
  for (const a of avisos) console.warn(`⚠️  ${a}`);
  for (const e of errores) console.error(`❌ ${e}`);
  if (errores.length) {
    console.error(`\n${errores.length} página(s) fuera de presupuesto. Límites en budget.json.`);
    process.exit(1);
  }
  console.log(`✔ Todas las páginas dentro del presupuesto (${seg} s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
