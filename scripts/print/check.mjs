// Chequeos del PDF de un volumen (issue #9). Los usa build.mjs; cada
// función devuelve evidencia (texto) y/o lanza con un mensaje que nombra
// la pieza. Herramientas: typst query, poppler (pdfinfo, pdffonts,
// pdftotext, pdftoppm), pdf-lib (anotaciones, marcadores, tamaños de
// letra en los content streams) y jsQR (decodificar los QR).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { RAIZ, reglas } from './lib/reglas.mjs';

export class ErrorBuild extends Error {}
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts });

/** Metadata de inicio/fin de cada pliego (página real) vía typst query. */
export function paginasReales(bin, jsonRel, variante) {
  const out = sh(bin, ['query', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'volumen.typ'), 'metadata', '--field', 'value']);
  const marcas = JSON.parse(out).filter((m) => m && m.tipo && m.n != null);
  const pliegos = new Map();
  for (const m of marcas) {
    const p = pliegos.get(m.n) ?? {};
    p[m.tipo] = m.pagina;
    pliegos.set(m.n, p);
  }
  return pliegos;
}

/** Desbordes: un pliego que no termina en su página. Falla nombrando la pieza. */
export function revisarDesbordes(vol, reales) {
  const errores = [];
  for (const p of vol.pliegos) {
    const r = reales.get(p.n);
    if (!r) { errores.push(`pág. ${p.n}: sin marcadores en el PDF (¿el pliego no se renderizó?)`); continue; }
    if (r.inicio !== p.n || r.fin !== p.n) {
      const titulo = tituloPliego(p);
      const donde = p.origen ? ` (${p.origen.archivo}:${p.origen.linea})` : '';
      errores.push(`La pieza "${titulo}" (pág. ${p.n})${donde} no cabe: empieza en la pág. ${r.inicio} y termina en la pág. ${r.fin}. Recortá el texto, achicá las fotos o pedí más páginas. El texto NO se achica.`);
      break; // el primero corre todo lo demás; con uno alcanza
    }
  }
  return errores;
}

export function tituloPliego(p) {
  const buscar = (nodos) => {
    for (const n of nodos ?? []) {
      if (n.t === 'componente' && (n.nombre === 'SectionTitle' || n.nombre === 'PostCover')) return n.nombre === 'PostCover' ? n.props.title : textoDe(n.hijos);
      if (n.t === 'componente' && n.nombre === 'Portada') return n.props.title;
      if (n.t === 'titulo') return textoDe(n.hijos);
      const h = buscar(n.hijos ?? (n.items ? n.items.flat() : []));
      if (h) return h;
    }
    return null;
  };
  return buscar(p.nodos) ?? (p.tipo === 'relleno' ? `relleno (${p.relleno})` : p.tipo);
}
const textoDe = (nodos) => (nodos ?? []).map((n) => (n.t === 'texto' ? n.v : textoDe(n.hijos))).join('');

/** Índice: número impreso = página real de inicio del pliego. */
export function revisarIndice(vol, reales) {
  const filas = [];
  const errores = [];
  for (const it of vol.indice) {
    const real = reales.get(it.pagina)?.inicio;
    filas.push({ titulo: it.titulo, indice: it.pagina, real, ok: real === it.pagina });
    if (real !== it.pagina) errores.push(`índice: "${it.titulo}" dice pág. ${it.pagina} pero la pieza empieza en la pág. ${real}.`);
  }
  return { filas, errores };
}

export function pdfinfo(pdf) {
  const out = sh('pdfinfo', ['-box', pdf]);
  const g = (k) => (out.match(new RegExp(`^${k}:\\s+(.*)$`, 'm')) || [])[1]?.trim();
  const caja = (k) => (g(k) || '').split(/\s+/).map(Number);
  return { pages: Number(g('Pages')), size: g('Page size'), media: caja('MediaBox'), trim: caja('TrimBox'), bleed: caja('BleedBox') };
}

/** Todas las páginas con las cajas pedidas (pdf-lib). */
export async function revisarCajas(pdf, esperado) {
  const doc = await PDFDocument.load(fs.readFileSync(pdf), { updateMetadata: false });
  const malas = [];
  const casi = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.01);
  doc.getPages().forEach((p, i) => {
    const m = p.getMediaBox(), t = p.getTrimBox(), b = p.getBleedBox();
    const toArr = (r) => [r.x, r.y, r.x + r.width, r.y + r.height];
    if (!casi(toArr(m), esperado.media) || !casi(toArr(t), esperado.trim) || !casi(toArr(b), esperado.bleed)) malas.push(i + 1);
  });
  return { paginas: doc.getPageCount(), malas };
}

export function pdffonts(pdf) {
  return sh('pdffonts', [pdf]).split('\n').slice(2).filter(Boolean).map((l) => {
    const c = l.trim().split(/\s+/);
    return { nombre: c[0].replace(/^[A-Z]{6}\+/, ''), emb: c[c.length - 5] };
  });
}

export function textoPagina(pdf, p) {
  return sh('pdftotext', ['-f', String(p), '-l', String(p), '-layout', pdf, '-']);
}

/** Mapa de páginas: portada sola, índice solo, Fin, contraportada, folios 2…N-1. */
export function revisarMapa(vol, pdf) {
  const N = vol.paginas;
  const errores = [];
  const filas = [];
  const folio = (n) => String(n).padStart(2, '0');
  for (let p = 1; p <= N; p++) {
    const t = textoPagina(pdf, p);
    const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);
    // El folio es lo último de la página (27 pt del corte): solo en su
    // línea, o al final de la marca "EDICIÓN DE PRUEBA" en volúmenes de prueba.
    // (en volúmenes de prueba, la marca "EDICIÓN DE PRUEBA" queda debajo).
    const tieneFolio = lineas.slice(-3).some((l) => l === folio(p));
    const pliego = vol.pliegos[p - 1];
    let esperado = '';
    let ok = true;
    // El tracking de la etiqueta "VOLUMEN NN" hace que pdftotext separe letras: se compara sin espacios.
    if (p === 1) { esperado = 'portada'; ok = /VOLUMEN/.test(t.replace(/\s+/g, '')) && !/ÍNDICE/.test(t); }
    else if (p === 2) { esperado = 'índice'; ok = /ÍNDICE/.test(t); }
    else if (p === N - 1) { esperado = 'fin'; ok = /\bFIN\b/i.test(t); }
    else if (p === N) { esperado = 'contraportada'; ok = /Mascota: ilustración por encargo/.test(t); }
    else esperado = pliego.tipo === 'relleno' ? `relleno (${pliego.relleno})` : tituloPliego(pliego);
    const folioOk = p === 1 || p === N ? !tieneFolio : tieneFolio;
    filas.push({ p, tipo: esperado, folio: tieneFolio ? folio(p) : '—', ok: ok && folioOk });
    if (!ok) errores.push(`pág. ${p}: se esperaba ${esperado} y el texto no lo muestra.`);
    if (!folioOk) errores.push(`pág. ${p}: folio ${tieneFolio ? 'presente' : 'ausente'} (${p === 1 || p === N ? 'no debe llevar' : 'debe llevar'}).`);
  }
  return { filas, errores };
}

/** Anotaciones /Link y marcadores (Outlines) con pdf-lib. */
export async function ligasYMarcadores(pdf) {
  const doc = await PDFDocument.load(fs.readFileSync(pdf), { updateMetadata: false });
  let links = 0;
  for (const p of doc.getPages()) {
    const annots = p.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = doc.context.lookup(annots.get(i));
      if (a?.get(PDFName.of('Subtype'))?.toString() === '/Link') links++;
    }
  }
  const outlines = doc.catalog.get(PDFName.of('Outlines'));
  let marcadores = 0;
  if (outlines) {
    const o = doc.context.lookup(outlines);
    const count = o?.get(PDFName.of('Count'));
    marcadores = count ? Math.abs(Number(count.toString())) : 1;
  }
  return { links, marcadores };
}

/** Tamaños de letra usados (operador Tf × escala de Tm) por fuente. */
export async function tamanosDeLetra(pdf) {
  const doc = await PDFDocument.load(fs.readFileSync(pdf), { updateMetadata: false });
  const conteo = new Map();
  for (const p of doc.getPages()) {
    const fuentes = {};
    const res = p.node.Resources()?.get(PDFName.of('Font'));
    const dict = res ? doc.context.lookup(res) : null;
    if (dict) for (const [k, v] of dict.entries()) { const f = doc.context.lookup(v); fuentes[k.toString()] = f?.get(PDFName.of('BaseFont'))?.toString().replace(/^\/[A-Z]{6}\+/, '').replace(/^\//, '') ?? '?'; }
    const c = p.node.Contents();
    const streams = c instanceof PDFRawStream ? [c] : c ? c.array.map((r) => doc.context.lookup(r)) : [];
    let fuente = '?', tf = 0, escala = 1;
    for (const s of streams) {
      const txt = Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
      for (const m of txt.matchAll(/(\/\S+)\s+([\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+[-\d.]+\s+[-\d.]+\s+Tm|\[[^\]]*\]\s*TJ|\([^)]*\)\s*Tj/g)) {
        if (m[2] != null) { fuente = fuentes[m[1]] ?? m[1]; tf = parseFloat(m[2]); }
        else if (m[3] != null) { escala = Math.sqrt(Math.abs(parseFloat(m[3]) * parseFloat(m[6]) - parseFloat(m[4]) * parseFloat(m[5]))) || 1; }
        else { const size = Math.round(tf * escala * 100) / 100; const k = `${fuente}|${size}`; conteo.set(k, (conteo.get(k) ?? 0) + 1); }
      }
    }
  }
  return [...conteo.entries()].map(([k, n]) => { const [fuente, size] = k.split('|'); return { fuente, pt: Number(size), usos: n }; }).sort((a, b) => a.pt - b.pt || a.fuente.localeCompare(b.fuente));
}

/** ppi efectivo de cada foto en imprenta: < umbral error, 150–299 aviso. */
export function revisarPpi(vol) {
  const filas = [], errores = [], avisos = [];
  const I = reglas.imagenes;
  for (const f of vol.fotos) {
    if (!f.existe) continue;
    for (const u of f.usos) {
      if (u.ppi == null) continue;
      const estado = u.ppi < I.ppi_error_menor_a ? 'ERROR' : u.ppi < I.ppi_objetivo ? 'advertencia' : 'ok';
      filas.push({ pliego: u.pliego, componente: u.componente, foto: f.master, px: `${f.ancho_px}×${f.alto_px}`, ancho_pt: Math.round(u.ancho_pt), ppi: u.ppi, estado });
      const pliego = vol.pliegos[u.pliego - 1];
      if (estado === 'ERROR') errores.push(`La foto ${f.master} en la pieza "${tituloPliego(pliego)}" (pág. ${u.pliego}, <${u.componente}>) queda a ${u.ppi} ppi (${f.ancho_px} px en ${(u.ancho_pt / 72).toFixed(2)} in): menos de ${I.ppi_error_menor_a}. Usá un master más grande o colocala más chica.`);
      else if (estado === 'advertencia') avisos.push(`foto ${f.master} pág. ${u.pliego}: ${u.ppi} ppi (${I.ppi_advertencia_desde}–${I.ppi_advertencia_hasta}: advertencia).`);
    }
  }
  return { filas, errores, avisos };
}

/** Decodifica los QR de una página rasterizada con jsQR (varios por
 *  página: se tapa cada uno encontrado y se vuelve a buscar). jsQR es
 *  sensible a la resolución, así que se prueban varias hasta leer todos
 *  los `esperados`. Con `zbarimg` en PATH se usa ese primero. */
async function qrsDePagina(pdf, p, esperados = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
  const urls = new Set();
  const falta = () => esperados.some((u) => !urls.has(u));
  for (const dpi of [150, 300, 200, 250]) {
    const base = path.join(tmp, `p${dpi}`);
    execFileSync('pdftoppm', ['-r', String(dpi), '-f', String(p), '-l', String(p), '-singlefile', '-png', pdf, base], { stdio: 'ignore' });
    const zbar = spawnSync('zbarimg', ['-q', '--raw', `${base}.png`], { encoding: 'utf8' });
    if (zbar.status === 0) for (const l of zbar.stdout.split('\n')) if (l.trim()) urls.add(l.trim());
    const { data, info } = await sharp(`${base}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
    for (let i = 0; i < 12; i++) {
      const r = jsQR(px, info.width, info.height);
      if (!r) break;
      if (r.data) urls.add(r.data);
      const { topLeftCorner: a, bottomRightCorner: b } = r.location;
      for (let y = Math.max(0, Math.floor(a.y) - 6); y < Math.min(info.height, Math.ceil(b.y) + 6); y++)
        for (let x = Math.max(0, Math.floor(a.x) - 6); x < Math.min(info.width, Math.ceil(b.x) + 6); x++) { const o = (y * info.width + x) * 4; px[o] = px[o + 1] = px[o + 2] = 255; }
    }
    if (!falta()) break;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return [...urls];
}

/** Cada QR de video del volumen se decodifica a su URL en la página que toca. */
export async function revisarQr(vol, pdf) {
  const filas = [], errores = [];
  const videos = (nodos, acc) => { for (const n of nodos ?? []) { if (n.t === 'componente' && n.nombre === 'VideoPoster') acc.push(n.props.url); videos(n.hijos ?? (n.items ? n.items.flat() : []), acc); } return acc; };
  for (const p of vol.pliegos) {
    const urls = videos(p.nodos, []);
    if (!urls.length) continue;
    const leidos = await qrsDePagina(pdf, p.n, urls);
    for (const u of urls) {
      const ok = leidos.includes(u);
      filas.push({ pagina: p.n, url: u, leido: ok });
      if (!ok) errores.push(`pág. ${p.n}: el QR de ${u} no se pudo decodificar (leídos: ${leidos.join(', ') || 'ninguno'}).`);
    }
  }
  return { filas, errores };
}

export function pesoMB(p) { return fs.statSync(p).size / 1024 / 1024; }
