// Pasos del cuadernillo y la versión xerox (issue #10) que usa build.mjs:
// imposición, chequeos de orden (marcas-prueba), escala de grises, tóner,
// ppi de las fotos embebidas, escala 1 y miniaturas de las caras.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { RAIZ, reglas } from './lib/reglas.mjs';
import { imponer, ordenCaras } from './impose.mjs';
import { ErrorBuild, pdfinfo, pdffonts } from './check.mjs';

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts });

/** Impone `origen` → `destino`. Devuelve caras y totales. */
export async function cuadernillo(origen, destino, caja, titulo) {
  const r = await imponer(fs.readFileSync(origen), { caja, titulo });
  fs.writeFileSync(destino, r.bytes);
  return r;
}

/** Lee "P01"…"PN" de la mitad izquierda y derecha de cada cara. */
export function leerCaras(pdf, caras) {
  const C = reglas.formato.cuadernillo, pw = reglas.formato.corte.ancho_pt, ph = reglas.formato.corte.alto_pt;
  const num = (t) => { const m = t.match(/P(\d{2,})/); return m ? Number(m[1]) : null; };
  const out = [];
  for (let i = 1; i <= caras; i++) {
    const leer = (x) => sh('pdftotext', ['-f', String(i), '-l', String(i), '-x', String(x), '-y', '0', '-W', String(pw), '-H', String(ph), pdf, '-']);
    out.push([num(leer(0)), num(leer(pw))]);
  }
  return out;
}

/** Test de integración del orden: compila con marcas-prueba, impone y compara con la tabla. */
export function verificarOrden(bin, jsonRel, variante, caja, n) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orden-'));
  const marcado = path.join(tmp, 'marcado.pdf');
  const r = spawnSync(bin, ['compile', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--creation-timestamp', process.env.SOURCE_DATE_EPOCH ?? '0', '--input', `variante=${variante}`, '--input', 'marcas-prueba=true', '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'volumen.typ'), marcado], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new ErrorBuild(`marcas-prueba (${variante}): ${r.stderr.trim()}`);
  return (async () => {
    if (caja === 'trim') { const { cajasImprenta } = await import('./build-prueba.mjs'); await cajasImprenta(marcado); }
    const salida = path.join(tmp, 'cuadernillo.pdf');
    const imp = await cuadernillo(marcado, salida, caja, 'prueba de orden');
    const esperado = ordenCaras(n);
    const leido = leerCaras(salida, esperado.length);
    fs.rmSync(tmp, { recursive: true, force: true });
    const ok = JSON.stringify(leido) === JSON.stringify(esperado);
    return { ok, esperado, leido, caras: imp.caras.length };
  })();
}

/** Todas las páginas en escala de grises pura (|R−G|, |G−B| ≤ 2 a 50 dpi) + tóner (% luma < 20). */
export async function grisesYToner(pdf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gris-'));
  execFileSync('pdftoppm', ['-r', '50', '-png', pdf, path.join(tmp, 'p')], { stdio: 'ignore' });
  const archivos = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  let maxRG = 0, maxGB = 0;
  const toner = [];
  for (const [i, f] of archivos.entries()) {
    const { data } = await sharp(path.join(tmp, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let negros = 0;
    for (let o = 0; o < data.length; o += 3) {
      maxRG = Math.max(maxRG, Math.abs(data[o] - data[o + 1]));
      maxGB = Math.max(maxGB, Math.abs(data[o + 1] - data[o + 2]));
      if (data[o] < 20 && data[o + 1] < 20 && data[o + 2] < 20) negros++;
    }
    toner.push({ pagina: i + 1, pct: Math.round((1000 * negros) / (data.length / 3)) / 10 });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { paginas: archivos.length, maxRG, maxGB, gris: maxRG <= 2 && maxGB <= 2, toner };
}

/** `pdfimages -list`: ppi mínimo de las imágenes embebidas (x-ppi / y-ppi). */
export function ppiEmbebidas(pdf) {
  const lineas = sh('pdfimages', ['-list', pdf]).split('\n').slice(2).filter((l) => l.trim());
  const cab = sh('pdfimages', ['-list', pdf]).split('\n')[0].trim().split(/\s+/);
  const ix = cab.indexOf('x-ppi'), iy = cab.indexOf('y-ppi'), it = cab.indexOf('type');
  const imgs = lineas.map((l) => l.trim().split(/\s+/)).filter((c) => c[it] === 'image').map((c) => ({ xppi: Number(c[ix]), yppi: Number(c[iy]) })).filter((i) => Number.isFinite(i.xppi));
  const min = imgs.length ? Math.min(...imgs.map((i) => Math.min(i.xppi, i.yppi))) : null;
  return { imagenes: imgs.length, ppi_min: min };
}

/** Escala de las páginas embebidas en el cuadernillo: matrices `cm` de la primera cara. */
export async function escalaCuadernillo(pdf) {
  const doc = await PDFDocument.load(fs.readFileSync(pdf), { updateMetadata: false });
  const p = doc.getPage(0);
  const c = p.node.Contents();
  const streams = c instanceof PDFRawStream ? [c] : c.array.map((r) => doc.context.lookup(r));
  const txt = streams.map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
  const cms = [...txt.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map((m) => m.slice(1, 7).map(Number));
  return { cm: cms, escala1: cms.every((m) => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1), tamano: pdfinfo(pdf).size };
}

/** Miniaturas de las caras (pdftoppm -r 40 + montaje) en `salida`. */
export async function miniaturasCaras(pdf, salida) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caras-'));
  execFileSync('pdftoppm', ['-r', '40', '-png', pdf, path.join(tmp, 'c')], { stdio: 'ignore' });
  const archivos = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const w = 440, h = 340, cols = 2, rows = Math.ceil(archivos.length / cols);
  const comp = [];
  for (const [i, f] of archivos.entries()) {
    const etiqueta = Buffer.from(`<svg width="${w}" height="${h}"><text x="6" y="16" font-size="14" font-family="sans-serif" fill="#e4002b">cara ${i + 1} (${i % 2 === 0 ? 'frente' : 'vuelta'} hoja ${Math.floor(i / 2) + 1})</text></svg>`);
    const img = await sharp(path.join(tmp, f)).resize(w, h, { fit: 'contain', background: '#dddddd' }).composite([{ input: etiqueta, top: 0, left: 0 }]).toBuffer();
    comp.push({ input: img, left: (i % cols) * (w + 8), top: Math.floor(i / cols) * (h + 8) });
  }
  await sharp({ create: { width: cols * (w + 8), height: rows * (h + 8), channels: 3, background: '#888888' } }).composite(comp).png().toFile(salida);
  fs.rmSync(tmp, { recursive: true, force: true });
  return archivos.length;
}

export { pdffonts };
