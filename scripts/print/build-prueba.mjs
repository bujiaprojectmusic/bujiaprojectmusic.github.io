// Genera la hoja de prueba de impresión (issue #16) con Typst:
//   print/build/jirafa-prueba-impresion.pdf            (pantalla, 396 × 612)
//   print/build/jirafa-prueba-impresion-imprenta.pdf   (450 × 666 + TrimBox/BleedBox + marcas)
//   print/build/jirafa-prueba-impresion-bn.pdf         (escala de grises)
//   print/build/jirafa-prueba-doble-cara.pdf           (carta horizontal, 2 caras)
// Antes prepara en print/build/cache/ el QR (qrcode, sin red) y los recortes
// de la foto de muestra a 300 y 150 ppi (sharp; el original no se toca).
// Determinista: `--creation-timestamp $SOURCE_DATE_EPOCH` (0 si no está).
// Uso: npm run print:prueba   (requiere Typst = print/TYPST_VERSION:
//      npm run print:install, o TYPST_BIN=/ruta/typst)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { RAIZ, reglas } from './lib/reglas.mjs';

const BUILD = path.join(RAIZ, 'print', 'build');
const CACHE = path.join(BUILD, 'cache');
const FUENTES = path.join(RAIZ, 'print', 'fonts');
const VERSION = fs.readFileSync(path.join(RAIZ, 'print', 'TYPST_VERSION'), 'utf8').trim();
const EPOCH = process.env.SOURCE_DATE_EPOCH ?? '0';

export const SALIDAS = {
  pantalla: path.join(BUILD, 'jirafa-prueba-impresion.pdf'),
  imprenta: path.join(BUILD, 'jirafa-prueba-impresion-imprenta.pdf'),
  bn: path.join(BUILD, 'jirafa-prueba-impresion-bn.pdf'),
  dobleCara: path.join(BUILD, 'jirafa-prueba-doble-cara.pdf'),
};

/** Busca el binario de Typst (TYPST_BIN, print/build/bin, PATH) y exige la versión fijada. */
export function typstBin() {
  const candidatos = [process.env.TYPST_BIN, path.join(BUILD, 'bin', 'typst'), 'typst'].filter(Boolean);
  for (const bin of candidatos) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (r.status !== 0) continue;
    const vista = r.stdout.trim().split(/\s+/)[1];
    if (vista !== VERSION) {
      throw new Error(`${bin} es typst ${vista}; print/TYPST_VERSION pide ${VERSION}. Corré npm run print:install.`);
    }
    return bin;
  }
  throw new Error(`No encuentro Typst ${VERSION}. Corré: npm run print:install (o TYPST_BIN=/ruta/typst).`);
}

export function verificarFuentes() {
  execFileSync('sha256sum', ['-c', '--strict', 'SHA256SUMS'], { cwd: FUENTES, stdio: ['ignore', 'pipe', 'inherit'] });
  const esperadas = ['Anton-Regular.ttf', 'SpaceMono-Regular.ttf', 'SpaceMono-Bold.ttf', 'SpaceMono-Italic.ttf', 'SpaceMono-BoldItalic.ttf'];
  for (const f of esperadas) {
    if (!fs.existsSync(path.join(FUENTES, f))) throw new Error(`falta print/fonts/${f}`);
  }
  console.log(`✔ fuentes: ${esperadas.length} TTF con sha256 verificado (print/fonts/SHA256SUMS)`);
}

/** Recorte centrado de la foto de muestra a `px` × `px` (jpeg sRGB), color y B/N. */
async function fotoMuestra(src, px, destino, bn) {
  let img = sharp(src, { failOn: 'none' }).rotate().resize(px, px, { fit: 'cover', position: 'centre' });
  if (bn) {
    const b = reglas.bn;
    // Punto negro/blanco + gamma de reglas.bn (esquema xerox).
    const lo = Math.round((b.punto_negro_pct / 100) * 255);
    const hi = Math.round((b.punto_blanco_pct / 100) * 255);
    img = img.grayscale().gamma(b.gamma).linear((hi - lo) / 255, lo);
  }
  await img.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).withMetadata({ density: 300 }).toFile(destino);
}

export async function prepararCache() {
  fs.mkdirSync(CACHE, { recursive: true });
  const P = reglas.prueba;
  const svg = await QRCode.toString(P.qr_url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  fs.writeFileSync(path.join(CACHE, 'qr-muestra.svg'), svg);
  const foto = path.join(RAIZ, P.foto);
  const antes = execFileSync('sha256sum', [foto], { encoding: 'utf8' });
  for (const ppi of [300, 150]) {
    const px = Math.round(P.foto_lado_in * ppi);
    await fotoMuestra(foto, px, path.join(CACHE, `foto-${ppi}.jpg`), false);
    await fotoMuestra(foto, px, path.join(CACHE, `foto-${ppi}-bn.jpg`), true);
  }
  const despues = execFileSync('sha256sum', [foto], { encoding: 'utf8' });
  if (antes !== despues) throw new Error(`la foto original cambió: ${P.foto}`);
  console.log(`✔ caché: qr-muestra.svg, foto-300/150(-bn).jpg (original ${P.foto} intacta)`);
}

export function compilar(bin, fuente, salida, variante) {
  const args = ['compile', '--root', RAIZ, '--font-path', FUENTES, '--ignore-system-fonts', '--creation-timestamp', EPOCH];
  if (variante) args.push('--input', `variante=${variante}`);
  args.push(fuente, salida);
  execFileSync(bin, args, { cwd: RAIZ, stdio: 'inherit' });
}

/** Typst no escribe TrimBox/BleedBox: se agregan con pdf-lib (determinista). */
export async function cajasImprenta(ruta) {
  const F = reglas.formato;
  const pdf = await PDFDocument.load(fs.readFileSync(ruta), { updateMetadata: false });
  for (const pagina of pdf.getPages()) {
    pagina.setMediaBox(0, 0, F.mediabox_imprenta.ancho_pt, F.mediabox_imprenta.alto_pt);
    pagina.setTrimBox(F.mediabox_imprenta.offset_trim_pt, F.mediabox_imprenta.offset_trim_pt, F.corte.ancho_pt, F.corte.alto_pt);
    pagina.setBleedBox(F.mediabox_imprenta.offset_bleed_pt, F.mediabox_imprenta.offset_bleed_pt, F.bleedbox.ancho_pt, F.bleedbox.alto_pt);
  }
  fs.writeFileSync(ruta, await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }));
}

export async function construir() {
  const bin = typstBin();
  console.log(`✔ typst ${VERSION} (${bin}), SOURCE_DATE_EPOCH=${EPOCH}`);
  verificarFuentes();
  fs.mkdirSync(BUILD, { recursive: true });
  await prepararCache();
  const prueba = path.join(RAIZ, 'print', 'prueba.typ');
  for (const variante of ['pantalla', 'imprenta', 'bn']) {
    compilar(bin, prueba, SALIDAS[variante], variante);
    if (variante === 'imprenta') await cajasImprenta(SALIDAS.imprenta);
    console.log(`✔ ${path.relative(RAIZ, SALIDAS[variante])} (${variante})`);
  }
  compilar(bin, path.join(RAIZ, 'print', 'prueba-doble-cara.typ'), SALIDAS.dobleCara, null);
  console.log(`✔ ${path.relative(RAIZ, SALIDAS.dobleCara)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  construir().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
}
