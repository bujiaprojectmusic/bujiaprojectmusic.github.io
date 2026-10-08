// Verifica los PDF de print/build/ contra print/reglas.json con poppler
// (pdfinfo, pdffonts, pdftoppm, pdftotext) y sharp. Imprime una línea de
// evidencia por criterio del issue #16 (C3 … C12) y sale 1 si algo falla.
// Uso: npm run print:verify   (después de npm run print:prueba)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { RAIZ, reglas } from './lib/reglas.mjs';
import { SALIDAS, typstBin, construir } from './build-prueba.mjs';

const VERSION = fs.readFileSync(path.join(RAIZ, 'print', 'TYPST_VERSION'), 'utf8').trim();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-'));
const fallos = [];
const rel = (p) => path.relative(RAIZ, p);
const ok = (c, msg) => console.log(`✔ C${c}: ${msg}`);
const mal = (c, msg) => { console.log(`✖ C${c}: ${msg}`); fallos.push(`C${c}: ${msg}`); };
const check = (c, cond, msg) => (cond ? ok(c, msg) : mal(c, msg));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts });
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const F = reglas.formato, M = reglas.margenes, P = reglas.prueba;
const casi = (a, b, tol) => Math.abs(a - b) <= tol;

function pdfinfo(p) {
  const out = sh('pdfinfo', ['-box', p]);
  const g = (k) => (out.match(new RegExp(`^${k}:\\s+(.*)$`, 'm')) || [])[1]?.trim();
  const caja = (k) => (g(k) || '').split(/\s+/).map(Number);
  return { pages: Number(g('Pages')), size: g('Page size'), media: caja('MediaBox'), trim: caja('TrimBox'), bleed: caja('BleedBox') };
}
function pdffonts(p) {
  return sh('pdffonts', [p]).split('\n').slice(2).filter(Boolean).map((l) => {
    const c = l.trim().split(/\s+/);
    return { nombre: c[0].replace(/^[A-Z]{6}\+/, ''), emb: c[c.length - 5] };
  });
}
/** Rasteriza una página a `dpi`; devuelve w, h y px(x, y) → [r, g, b]. */
async function raster(pdf, pagina, dpi) {
  const base = path.join(TMP, `${path.basename(pdf, '.pdf')}-${pagina}-${dpi}`);
  execFileSync('pdftoppm', ['-r', String(dpi), '-f', String(pagina), '-l', String(pagina), '-singlefile', '-png', pdf, base], { stdio: ['ignore', 'ignore', 'ignore'] });
  const { data, info } = await sharp(`${base}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, px: (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; } };
}
const esNegro = ([r, g, b]) => r < 100 && g < 100 && b < 100;
const caja = (b) => `${b[0]} ${b[1]} ${b[2]} ${b[3]} (${b[2] - b[0]} × ${b[3] - b[1]} pt, offset ${b[0]})`;

for (const p of Object.values(SALIDAS)) {
  if (!fs.existsSync(p)) { console.error(`✖ falta ${rel(p)}: corré npm run print:prueba`); process.exit(1); }
}

// ── C3: versión de Typst ───────────────────────────────────────────────
const bin = typstBin();
const vista = sh(bin, ['--version']).trim();
check(3, vista.split(/\s+/)[1] === VERSION, `typst --version → "${vista}" = print/TYPST_VERSION (${VERSION}); sha256 del binario lo verifica scripts/print/install-typst.sh`);

// ── C4: fuentes con sha256 y sólo Anton / Space Mono embebidas ─────────
const sums = sh('sha256sum', ['-c', '--strict', 'SHA256SUMS'], { cwd: path.join(RAIZ, 'print', 'fonts') }).trim().split('\n');
check(4, sums.filter((l) => l.endsWith(': OK')).length === 7, `sha256sum -c print/fonts/SHA256SUMS → ${sums.filter((l) => l.endsWith(': OK')).length} OK (5 TTF + 2 OFL)`);
for (const [k, p] of Object.entries(SALIDAS)) {
  const fuentes = pdffonts(p);
  const raras = fuentes.filter((f) => !/^(Anton|SpaceMono)-/.test(f.nombre) || f.emb !== 'yes');
  check(4, fuentes.length > 0 && raras.length === 0, `pdffonts ${rel(p)} → ${fuentes.map((f) => `${f.nombre} emb=${f.emb}`).join(', ')}${raras.length ? ' ← NO permitida' : ''}`);
}

// ── C5: pantalla 396 × 612 ─────────────────────────────────────────────
const ip = pdfinfo(SALIDAS.pantalla);
check(5, ip.size === `${F.pantalla.ancho_pt} x ${F.pantalla.alto_pt} pts` && ip.pages === P.paginas, `pdfinfo ${rel(SALIDAS.pantalla)} → Page size: ${ip.size}, Pages: ${ip.pages}`);

// ── C6: imprenta MediaBox / TrimBox / BleedBox ─────────────────────────
const ii = pdfinfo(SALIDAS.imprenta);
const mb = F.mediabox_imprenta;
const esperaMedia = [0, 0, mb.ancho_pt, mb.alto_pt];
const esperaTrim = [mb.offset_trim_pt, mb.offset_trim_pt, mb.offset_trim_pt + F.corte.ancho_pt, mb.offset_trim_pt + F.corte.alto_pt];
const esperaBleed = [mb.offset_bleed_pt, mb.offset_bleed_pt, mb.offset_bleed_pt + F.bleedbox.ancho_pt, mb.offset_bleed_pt + F.bleedbox.alto_pt];
const igual = (a, b) => a.length === 4 && a.every((v, i) => casi(v, b[i], 0.01));
check(6, igual(ii.media, esperaMedia) && igual(ii.trim, esperaTrim) && igual(ii.bleed, esperaBleed) && ii.pages === P.paginas,
  `pdfinfo -box ${rel(SALIDAS.imprenta)} → MediaBox ${caja(ii.media)}; TrimBox ${caja(ii.trim)}; BleedBox ${caja(ii.bleed)}`);

// ── C7: marcas de corte fuera del BleedBox (imprenta) y ausentes (pantalla)
{
  const dpi = 300, k = dpi / 72;
  const r = await raster(SALIDAS.imprenta, 1, dpi);
  // La marca mide 0.25 pt (≈ 1 px): se busca la columna más larga alrededor de x = 27 pt.
  const xTrim = Math.round(mb.offset_trim_pt * k);
  const oscuro = (x, y) => r.px(x, y).every((v) => v < 200);
  let largo = 0, col = xTrim;
  for (let x = xTrim - 2; x <= xTrim + 2; x++) {
    let l = 0; while (l < r.h && oscuro(x, l)) l++;
    if (l > largo) { largo = l; col = x; }
  }
  const finEsperado = (mb.offset_trim_pt - F.marcas_corte.inicio_desde_corte_pt) * k; // borde del BleedBox
  const dentroSangrado = oscuro(col, Math.round((mb.offset_bleed_pt + 2) * k)); // 2 pt adentro del BleedBox
  check(7, largo > 0 && casi(largo, finEsperado, 3) && !dentroSangrado,
    `imprenta p1 a ${dpi} dpi: marca vertical en x = ${mb.offset_trim_pt} pt va de y = 0 a ${(largo / k).toFixed(1)} pt (BleedBox empieza en ${mb.offset_bleed_pt} pt) y no entra en el sangrado`);
  const rp = await raster(SALIDAS.pantalla, 1, dpi);
  const banda = Math.round(3 * k); // 3 pt desde cada borde
  let negros = 0;
  for (let y = 0; y < rp.h; y++) for (let x = 0; x < rp.w; x++) {
    if (x < banda || y < banda || x >= rp.w - banda || y >= rp.h - banda) { if (esNegro(rp.px(x, y))) negros++; }
  }
  check(7, negros === 0, `pantalla p1 a ${dpi} dpi: ${negros} px negros en la franja de 3 pt del borde (sin marcas de corte)`);
}

// ── C8: 1 in de regla = 300 ± 1 px y cuadro 300 × 300 ± 1 px a 300 dpi ─
{
  const dpi = 300;
  const r = await raster(SALIDAS.pantalla, 1, dpi);
  // Cuadro: filas con una corrida negra de ~300 px.
  const filas = [];
  for (let y = 0; y < r.h; y++) {
    let x = 0;
    while (x < r.w) {
      if (!esNegro(r.px(x, y))) { x++; continue; }
      let x0 = x; while (x < r.w && esNegro(r.px(x, y))) x++;
      if (x - x0 > 250 && x - x0 < 350) filas.push({ y, x0, ancho: x - x0 });
    }
  }
  const anchos = filas.map((f) => f.ancho);
  const ancho = anchos.length ? anchos.sort((a, b) => a - b)[Math.floor(anchos.length / 2)] : 0;
  const alto = filas.filter((f) => casi(f.ancho, ancho, 2)).length;
  check(8, casi(ancho, dpi, 1) && casi(alto, dpi, 1), `cuadro de 1 in a ${dpi} dpi → ${ancho} × ${alto} px (esperado ${dpi} × ${dpi} ± 1)`);
  // Regla: línea superior (corrida ≥ 1000 px) y ticks mayores a 11 pt de profundidad.
  let yRegla = -1;
  for (let y = 0; y < r.h && yRegla < 0; y++) {
    let run = 0, max = 0;
    for (let x = 0; x < r.w; x++) { run = esNegro(r.px(x, y)) ? run + 1 : 0; if (run > max) max = run; }
    if (max >= 1000) yRegla = y;
  }
  const yTick = yRegla + Math.round(11 * dpi / 72);
  const centros = [];
  for (let x = 0; x < r.w; x++) {
    if (esNegro(r.px(x, yTick))) { let x0 = x; while (x < r.w && esNegro(r.px(x, yTick))) x++; centros.push((x0 + x - 1) / 2); }
  }
  const pasos = centros.slice(1).map((c, i) => c - centros[i]);
  check(8, yRegla >= 0 && pasos.length >= 4 && pasos.every((p) => casi(p, dpi, 1)), `regla: ticks de pulgada en x = ${centros.map((c) => c.toFixed(1)).join(', ')} px → pasos ${pasos.map((p) => p.toFixed(1)).join(', ')} px (esperado ${dpi} ± 1)`);
}

// ── C9: texto (pdftotext) ──────────────────────────────────────────────
{
  const texto = sh('pdftotext', ['-layout', SALIDAS.pantalla, '-']);
  const cadena = texto.includes(P.cadena);
  const faltan = [...P.muestras_space_mono_pt.map((s) => `${s} pt — Space Mono`), ...P.muestras_anton_pt.map((s) => `${s} pt — Anton`)].filter((m) => !texto.includes(m));
  check(9, cadena && faltan.length === 0, `pdftotext ${rel(SALIDAS.pantalla)} contiene "${P.cadena}" (${(texto.match(new RegExp(P.cadena, 'g')) || []).length} veces) y las muestras ${[...P.muestras_space_mono_pt, ...P.muestras_anton_pt].join(', ')} pt${faltan.length ? ` (faltan: ${faltan.join('; ')})` : ''}`);
  const calado = texto.includes(`Texto calado a ${P.calado_pt} pt`);
  check(9, calado, `bloque de texto calado a ${P.calado_pt} pt presente`);
}

// ── C10: doble cara 792 × 612, 2 páginas, cruces en espejo ─────────────
{
  const C = F.cuadernillo;
  const id = pdfinfo(SALIDAS.dobleCara);
  check(10, id.size.startsWith(`${C.hoja_ancho_pt} x ${C.hoja_alto_pt} pts`) && id.pages === 2, `pdfinfo ${rel(SALIDAS.dobleCara)} → Page size: ${id.size}, Pages: ${id.pages}`);
  const bbox = sh('pdftotext', ['-bbox', SALIDAS.dobleCara, '-']);
  const paginas = bbox.split('<page ').slice(1).map((pg) => {
    const w = {};
    // Sólo los números de las esquinas (a menos de 100 pt del borde superior o inferior).
    for (const m of pg.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([1-4])<\/word>/g)) {
      if (+m[2] < 100 || +m[2] > C.hoja_alto_pt - 100) w[m[5]] = { xMin: +m[1], xMax: +m[3], y: +m[2] };
    }
    return w;
  });
  const esp = ['1', '2', '3', '4'].map((n) => {
    const a = paginas[0]?.[n], b = paginas[1]?.[n];
    if (!a || !b) return { n, ok: false };
    // En espejo horizontal: xMin del frente + xMax de la vuelta = ancho de hoja; misma y.
    return { n, ok: casi(a.xMin + b.xMax, C.hoja_ancho_pt, 1.5) && casi(a.y, b.y, 1), a, b };
  });
  check(10, esp.every((e) => e.ok), `cruces numeradas en espejo: ${esp.map((e) => e.a ? `${e.n}: frente x=${e.a.xMin.toFixed(1)} ↔ vuelta x=${e.b.xMax.toFixed(1)} (suma ${(e.a.xMin + e.b.xMax).toFixed(1)} ≈ ${C.hoja_ancho_pt})` : `${e.n}: falta`).join('; ')}`);
  const dpi = 150, k = dpi / 72, m = P.doble_cara_cruz_margen_pt;
  const cruces = [];
  for (const pg of [1, 2]) {
    const r = await raster(SALIDAS.dobleCara, pg, dpi);
    const oscuro = (x, y) => r.px(x, y).every((v) => v < 200);
    for (const [x, y] of [[m, m], [C.hoja_ancho_pt - m, m], [m, C.hoja_alto_pt - m], [C.hoja_ancho_pt - m, C.hoja_alto_pt - m]]) {
      const cx = Math.round(x * k), cy = Math.round(y * k), d = Math.round(P.doble_cara_cruz_largo_pt / 2 * k * 0.8);
      // Los 4 brazos (líneas de 0.5 pt ≈ 1 px): se tolera ±1 px alrededor del centro.
      const brazos = [[cx + d, cy], [cx - d, cy], [cx, cy + d], [cx, cy - d]].every(([a, b]) => [-1, 0, 1].some((e) => oscuro(a + e, b) || oscuro(a, b + e)));
      cruces.push({ pg, x, y, ok: brazos });
    }
  }
  check(10, cruces.every((c) => c.ok), `cruces de registro a ${m} pt de cada borde en las 2 caras (${cruces.filter((c) => c.ok).length}/8 detectadas a ${dpi} dpi)`);
  const txt = sh('pdftotext', [SALIDAS.dobleCara, '-']);
  check(10, /FRENTE/.test(txt) && /VUELTA/.test(txt) && /borde corto/.test(txt), `texto: FRENTE, VUELTA y "voltear por el borde corto" presentes`);
}

// ── C11: bn en escala de grises pura + rampa completa ──────────────────
{
  const dpi = 50;
  let maxRG = 0, maxGB = 0, total = 0;
  const vistos = new Set();
  const pasos = []; for (let p = 0; p <= 100; p += P.grises_paso_pct) pasos.push(p);
  for (let pg = 1; pg <= P.paginas; pg++) {
    const r = await raster(SALIDAS.bn, pg, dpi);
    for (let i = 0; i < r.data.length; i += 3) {
      const R = r.data[i], G = r.data[i + 1], B = r.data[i + 2];
      maxRG = Math.max(maxRG, Math.abs(R - G)); maxGB = Math.max(maxGB, Math.abs(G - B)); total++;
      if (pg === 3) for (const p of pasos) if (casi(G, Math.round(255 * (1 - p / 100)), 4)) vistos.add(p);
    }
  }
  check(11, maxRG <= 2 && maxGB <= 2, `pdftoppm -r ${dpi} ${rel(SALIDAS.bn)}: ${total} px en ${P.paginas} páginas, máx |R−G| = ${maxRG}, máx |G−B| = ${maxGB} (≤ 2)`);
  const faltan = pasos.filter((p) => !vistos.has(p));
  check(11, faltan.length === 0, `rampa de grises en p3: ${pasos.length} pasos (${pasos.join(', ')} %) presentes${faltan.length ? `; faltan ${faltan.join(', ')}` : ''}`);
}

// ── C12: determinismo (dos compilaciones → mismo sha256) ───────────────
{
  const antes = Object.fromEntries(Object.entries(SALIDAS).map(([k, p]) => [k, sha(p)]));
  await construir();
  const despues = Object.fromEntries(Object.entries(SALIDAS).map(([k, p]) => [k, sha(p)]));
  const iguales = Object.keys(SALIDAS).every((k) => antes[k] === despues[k]);
  check(12, iguales, `segunda compilación (SOURCE_DATE_EPOCH=${process.env.SOURCE_DATE_EPOCH ?? '0'}) → ${Object.entries(despues).map(([k, s]) => `${path.basename(SALIDAS[k])} ${s.slice(0, 12)}${antes[k] === s ? ' =' : ' ≠ ' + antes[k].slice(0, 12)}`).join('; ')}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
if (fallos.length) { console.error(`\n✖ ${fallos.length} fallo(s):\n  - ${fallos.join('\n  - ')}`); process.exit(1); }
console.log('\n✔ hoja de prueba verificada');
