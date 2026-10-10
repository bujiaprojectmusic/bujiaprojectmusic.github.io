// Después de `astro build`: copia los PDF listados en print/build/manifest.json
// a dist/fanzine/<slug>/ (issue #9). Si no hay manifest (build local sin
// Typst) no hace nada y lo dice: el bloque de descarga ya mostró "PDF no
// disponible en este build". En CI el manifest es obligatorio.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib/reglas.mjs';

const manifest = path.join(RAIZ, 'print', 'build', 'manifest.json');
const manifestKit = path.join(RAIZ, 'print', 'build', 'kit', 'manifest-kit.json');
const dist = path.join(RAIZ, 'dist');
if (!fs.existsSync(manifest)) {
  if (process.env.CI) { console.error('✖ falta print/build/manifest.json: en CI el impreso es obligatorio (npm run print antes de npm run build).'); process.exit(1); }
  console.log('(sin print/build/manifest.json: no se copian PDF a dist/; corré npm run print antes del build)');
}
const m = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : { volumenes: [] };
for (const v of m.volumenes) {
  const destino = path.join(dist, 'fanzine', v.slug);
  fs.mkdirSync(destino, { recursive: true });
  for (const pdf of Object.values(v.pdfs)) {
    fs.copyFileSync(path.join(RAIZ, pdf.ruta), path.join(destino, pdf.archivo));
    console.log(`✔ dist/fanzine/${v.slug}/${pdf.archivo} (${(pdf.bytes / 1024 / 1024).toFixed(2)} MB)`);
  }
}

// Kit de componentes (issue #17): jirafa-kit.pdf, jirafa-kit-bn.pdf y las
// miniaturas Typst (typst/<Nombre>.png) a dist/fanzine/kit/. Sin
// manifest-kit.json (build local sin npm run print:kit) no copia nada; en CI es obligatorio.
if (!fs.existsSync(manifestKit)) {
  if (process.env.CI) { console.error('✖ falta print/build/kit/manifest-kit.json: en CI el kit es obligatorio (npm run print:kit antes de npm run build).'); process.exit(1); }
  console.log('(sin print/build/kit/manifest-kit.json: no se copia el kit a dist/fanzine/kit/)');
} else {
  const k = JSON.parse(fs.readFileSync(manifestKit, 'utf8'));
  const destino = path.join(dist, 'fanzine', 'kit');
  fs.mkdirSync(path.join(destino, 'typst'), { recursive: true });
  for (const pdf of Object.values(k.pdfs)) {
    fs.copyFileSync(path.join(RAIZ, pdf.ruta), path.join(destino, pdf.archivo));
    console.log(`✔ dist/fanzine/kit/${pdf.archivo} (${(pdf.bytes / 1024 / 1024).toFixed(2)} MB)`);
  }
  let bytes = 0;
  for (const c of k.componentes) { fs.copyFileSync(path.join(RAIZ, 'print', 'build', 'kit', c.png), path.join(destino, c.png)); bytes += c.bytes; }
  console.log(`✔ dist/fanzine/kit/typst/: ${k.componentes.length} miniaturas (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}
