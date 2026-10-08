// Variantes de las fotos de un volumen (sharp), desde los masters, en
// print/build/<slug>/img/ (ignorada por git). Los originales no se tocan.
//  - imprenta: el master tal cual (copia byte a byte; Typst respeta la
//    orientación EXIF y lee JPEG/PNG/WebP/SVG).
//  - pantalla: ~150 ppi del tamaño colocado más grande, JPEG q75.
//  - bn: igual que pantalla, en gris con punto negro/blanco y gamma de reglas.bn (#10).
// Calcula el ppi efectivo de cada uso (px del master / pulgadas colocadas)
// y lo escribe en el JSON. Caché por hash del master + parámetros.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { RAIZ, reglas } from './lib/reglas.mjs';

const I = reglas.imagenes;

export async function variantes(jsonPath) {
  const vol = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const dir = path.join(path.dirname(jsonPath), 'img');
  fs.mkdirSync(dir, { recursive: true });
  const rel = (p) => '/' + path.relative(RAIZ, p).split(path.sep).join('/');
  const informe = [];
  for (const foto of vol.fotos) {
    if (!foto.existe) continue;
    const master = path.join(RAIZ, foto.master);
    const ext = path.extname(master).toLowerCase() || `.${foto.formato}`;
    const hash = crypto.createHash('sha1').update(fs.readFileSync(master)).digest('hex').slice(0, 10);
    // imprenta: copia del master
    const imp = path.join(dir, `${foto.id}-${hash}-imprenta${ext}`);
    if (!fs.existsSync(imp)) fs.copyFileSync(master, imp);
    foto.imprenta = rel(imp);
    // ppi efectivo por uso (en imprenta, con el master)
    // Sin usos registrados (no debería pasar) se conserva el ancho completo.
    const anchoMax = foto.usos.length ? Math.max(...foto.usos.map((u) => u.ancho_pt)) : (foto.ancho_px / I.pantalla_ppi) * 72;
    for (const u of foto.usos) {
      u.ppi = foto.formato === 'svg' ? null : Math.round(foto.ancho_px / (u.ancho_pt / 72));
      informe.push({ pliego: u.pliego, componente: u.componente, master: foto.master, px: `${foto.ancho_px}×${foto.alto_px}`, ancho_pt: Math.round(u.ancho_pt), ppi: u.ppi });
    }
    if (foto.formato === 'svg') { foto.pantalla = foto.imprenta; foto.bn = foto.imprenta; continue; }
    // pantalla / bn
    const anchoPx = Math.min(foto.ancho_px, Math.round((anchoMax / 72) * I.pantalla_ppi));
    const esPng = ext === '.png';
    const pan = path.join(dir, `${foto.id}-${hash}-pantalla-${anchoPx}${esPng ? '.png' : '.jpg'}`);
    if (!fs.existsSync(pan)) {
      const s = sharp(master, { failOn: 'none' }).rotate().resize({ width: anchoPx, withoutEnlargement: true });
      await (esPng ? s.png() : s.jpeg({ quality: I.pantalla_jpeg_calidad, mozjpeg: true })).toFile(pan);
    }
    foto.pantalla = rel(pan);
    const B = reglas.bn;
    const bn = path.join(dir, `${foto.id}-${hash}-bn-${anchoPx}${esPng ? '.png' : '.jpg'}`);
    if (!fs.existsSync(bn)) {
      const lo = Math.round((B.punto_negro_pct / 100) * 255), hi = Math.round((B.punto_blanco_pct / 100) * 255);
      const s = sharp(master, { failOn: 'none' }).rotate().resize({ width: anchoPx, withoutEnlargement: true }).grayscale().gamma(B.gamma).linear((hi - lo) / 255, lo);
      await (esPng ? s.png() : s.jpeg({ quality: I.pantalla_jpeg_calidad, mozjpeg: true })).toFile(bn);
    }
    foto.bn = rel(bn);
  }
  fs.writeFileSync(jsonPath, JSON.stringify(vol, null, 2));
  return { vol, informe };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const p = process.argv[2];
  if (!p) { console.error('uso: node scripts/print/variantes.mjs print/build/<slug>/volumen.json'); process.exit(1); }
  variantes(p).then(({ informe }) => { for (const r of informe) console.log(`${String(r.pliego).padStart(2)}  ${r.componente.padEnd(14)} ${r.px.padEnd(10)} ${String(r.ancho_pt).padStart(4)} pt  ${r.ppi ?? '—'} ppi  ${r.master}`); }).catch((e) => { console.error('✖', e.message); process.exit(1); });
}
