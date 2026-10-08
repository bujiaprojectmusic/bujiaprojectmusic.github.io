// Después de `astro build`: copia los PDF listados en print/build/manifest.json
// a dist/fanzine/<slug>/ (issue #9). Si no hay manifest (build local sin
// Typst) no hace nada y lo dice: el bloque de descarga ya mostró "PDF no
// disponible en este build". En CI el manifest es obligatorio.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib/reglas.mjs';

const manifest = path.join(RAIZ, 'print', 'build', 'manifest.json');
const dist = path.join(RAIZ, 'dist');
if (!fs.existsSync(manifest)) {
  if (process.env.CI) { console.error('✖ falta print/build/manifest.json: en CI el impreso es obligatorio (npm run print antes de npm run build).'); process.exit(1); }
  console.log('(sin print/build/manifest.json: no se copian PDF a dist/; corré npm run print antes del build)');
  process.exit(0);
}
const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
for (const v of m.volumenes) {
  const destino = path.join(dist, 'fanzine', v.slug);
  fs.mkdirSync(destino, { recursive: true });
  for (const pdf of Object.values(v.pdfs)) {
    fs.copyFileSync(path.join(RAIZ, pdf.ruta), path.join(destino, pdf.archivo));
    console.log(`✔ dist/fanzine/${v.slug}/${pdf.archivo} (${(pdf.bytes / 1024 / 1024).toFixed(2)} MB)`);
  }
}
