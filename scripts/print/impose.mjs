// Imposición del cuadernillo (issue #10) con pdf-lib: de un PDF de N
// páginas de media carta (múltiplo de 4; si no, se rellena con blancos
// antes de las dos últimas) a hojas carta horizontales de 792 × 612 pt con
// 2 páginas por cara, en el orden de reglas.mjs cuadernillo(N):
//   hoja h: frente = [N-2(h-1) | 2h-1], vuelta = [2h | N-2h+1]
// Cada página se embebe como vector (embedPage con boundingBox = TrimBox
// o MediaBox) a escala 1: no se rasteriza ni se reescala. Metadatos fijos
// (SOURCE_DATE_EPOCH) para que la salida sea determinista.
import { PDFDocument } from 'pdf-lib';
import { reglas, cuadernillo } from './lib/reglas.mjs';

const F = reglas.formato;

/** Páginas 1…n rellenadas a múltiplo de 4 con `null` (blanco) antes de las dos últimas. */
export function rellenarAMultiplo(n, multiplo = reglas.paginas.multiplo) {
  const total = Math.ceil(n / multiplo) * multiplo;
  const paginas = Array.from({ length: n }, (_, i) => i + 1);
  const blancos = Array.from({ length: total - n }, () => null);
  if (n < 2) return [...paginas, ...blancos];
  return [...paginas.slice(0, n - 2), ...blancos, ...paginas.slice(n - 2)];
}

/** Orden de caras: [[izq, der], …] (frente, vuelta, frente, vuelta…), con `null` en blancos. */
export function ordenCaras(n) {
  const paginas = rellenarAMultiplo(n);
  const total = paginas.length;
  const caras = [];
  for (const h of cuadernillo(total)) {
    caras.push(h.frente.map((p) => paginas[p - 1]));
    caras.push(h.vuelta.map((p) => paginas[p - 1]));
  }
  return caras;
}

/**
 * Impone `bytes` (PDF de media carta) y devuelve los bytes del cuadernillo.
 * `caja`: 'trim' recorta cada página a su TrimBox (PDF de imprenta con
 * sangrado y marcas); 'media' usa la página completa (xerox, 396 × 612).
 */
export async function imponer(bytes, { caja = 'trim', epoch = Number(process.env.SOURCE_DATE_EPOCH ?? 0), titulo = 'Cuadernillo' } = {}) {
  const src = await PDFDocument.load(bytes, { updateMetadata: false });
  const n = src.getPageCount();
  const W = F.cuadernillo.hoja_ancho_pt, H = F.cuadernillo.hoja_alto_pt;
  const pw = F.corte.ancho_pt, ph = F.corte.alto_pt;
  const out = await PDFDocument.create();
  const fecha = new Date(epoch * 1000);
  out.setTitle(titulo); out.setProducer('pdf-lib'); out.setCreator('scripts/print/impose.mjs');
  out.setCreationDate(fecha); out.setModificationDate(fecha);
  const embebidas = new Map();
  const embeber = async (p) => {
    if (embebidas.has(p)) return embebidas.get(p);
    const pagina = src.getPage(p - 1);
    const box = caja === 'trim' ? pagina.getTrimBox() : pagina.getMediaBox();
    if (Math.abs(box.width - pw) > 0.01 || Math.abs(box.height - ph) > 0.01) {
      throw new Error(`página ${p}: la caja ${caja} mide ${box.width} × ${box.height} pt y el cuadernillo necesita ${pw} × ${ph}`);
    }
    const e = await out.embedPage(pagina, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height });
    embebidas.set(p, e);
    return e;
  };
  const caras = ordenCaras(n);
  for (const [izq, der] of caras) {
    const hoja = out.addPage([W, H]);
    // Sin xScale/yScale: escala 1, cada media página mide exactamente 396 × 612 pt.
    if (izq != null) hoja.drawPage(await embeber(izq), { x: 0, y: 0 });
    if (der != null) hoja.drawPage(await embeber(der), { x: pw, y: 0 });
  }
  return { bytes: await out.save({ useObjectStreams: false, updateFieldAppearances: false }), caras, paginas: n, total: rellenarAMultiplo(n).length };
}
