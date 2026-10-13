// Build del catálogo impreso de componentes (issue #17):
//   npm run print:kit
// Pasos: kit.ts (volumen sintético desde el registro → print/build/kit/volumen.json)
// → variantes (sharp) → typst compile print/kit.typ en pantalla y bn →
// chequeos (desbordes por página, pdffonts sólo Anton/SpaceMono, bn en
// escala de grises pura |R−G| ≤ 2) → miniaturas PNG a 150 dpi por
// componente (print/build/kit/typst/<Nombre>.png, para /fanzine/kit y el
// montaje web vs Typst) → print/build/kit/manifest-kit.json.
// Los PDF y PNG no se commitean: copy-dist.mjs los lleva a dist/fanzine/kit/.
// Caché (cache.mjs): si la huella del kit (su volumen.json + los archivos que
// nombra + el motor) no cambió, se restauran los PDF, las miniaturas y el
// manifest desde print/cache/kit/ sin compilar. --sin-cache la ignora.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { RAIZ, reglas } from './lib/reglas.mjs';
import { typstBin, verificarFuentes } from './build-prueba.mjs';
import { variantes } from './variantes.mjs';
import * as C from './check.mjs';
import * as Q from './cuadernillo.mjs';
import { huellaVolumen, restaurar, guardar } from './cache.mjs';

const BUILD = path.join(RAIZ, 'print', 'build');
const DIR = path.join(BUILD, 'kit');
const quiet = process.argv.includes('--quiet');
const usarCache = !process.argv.includes('--sin-cache');
const log = (...a) => { if (!quiet) console.log(...a); };
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function epoch() {
  if (process.env.SOURCE_DATE_EPOCH) return process.env.SOURCE_DATE_EPOCH;
  const r = spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: RAIZ, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : '0';
}
const EPOCH = epoch();
process.env.SOURCE_DATE_EPOCH = EPOCH;

export const SALIDAS = { pantalla: path.join(DIR, 'jirafa-kit.pdf'), bn: path.join(DIR, 'jirafa-kit-bn.pdf') };

function compilar(bin, jsonRel, variante, salida) {
  const r = spawnSync(bin, ['compile', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--creation-timestamp', EPOCH, '--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'kit.typ'), salida], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new C.ErrorBuild(`kit (${variante}): Typst falló:\n${r.stderr.replace(/\x1b\[[0-9;]*m/g, '').trim()}`);
}

export async function construirKit() {
  const t0 = Date.now();
  const bin = typstBin();
  verificarFuentes();
  fs.mkdirSync(DIR, { recursive: true });
  // 1) volumen sintético
  const r = spawnSync('npx', ['tsx', path.join(RAIZ, 'scripts', 'print', 'kit.ts'), '--salida', rel(DIR)], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new C.ErrorBuild((r.stderr || r.stdout).trim());
  log(r.stdout.trim());
  const jsonPath = path.join(DIR, 'volumen.json');
  const jsonRel = '/' + rel(jsonPath);
  // Caché: el kit sólo se recompila si cambió el registro, sus fotos demo o el motor.
  const huella = usarCache ? huellaVolumen(jsonPath) : null;
  const guardado = huella ? restaurar('kit', huella, DIR) : null;
  if (guardado) {
    fs.writeFileSync(path.join(DIR, 'manifest-kit.json'), JSON.stringify(guardado, null, 2));
    log(`↺ kit: sin cambios (huella ${huella.slice(0, 12)}): PDF y miniaturas desde la caché, no se compila`);
    return { ...guardado, cache: true };
  }
  // 2) variantes de fotos
  const { vol } = await variantes(jsonPath);
  const errores = [];
  // 3) compilar
  for (const [variante, salida] of Object.entries(SALIDAS)) compilar(bin, jsonRel, variante, salida);
  // 4) chequeos
  const reales = C.paginasReales(bin, jsonRel, 'pantalla');
  errores.push(...C.revisarDesbordes(vol, reales));
  if (errores.length) throw new C.ErrorBuild(`kit: ${errores.join('\n')}`);
  const info = Object.fromEntries(Object.entries(SALIDAS).map(([k, p]) => [k, C.pdfinfo(p)]));
  for (const [k, i] of Object.entries(info)) if (i.pages !== vol.paginas) errores.push(`${k}: ${i.pages} páginas (esperadas ${vol.paginas})`);
  const fuentes = {};
  for (const [k, p] of Object.entries(SALIDAS)) {
    fuentes[k] = C.pdffonts(p);
    const raras = fuentes[k].filter((f) => !/^(Anton|SpaceMono)-/.test(f.nombre) || f.emb !== 'yes');
    if (raras.length) errores.push(`${k}: fuentes no permitidas o sin embeber: ${raras.map((f) => f.nombre).join(', ')}`);
  }
  const gris = await Q.grisesYToner(SALIDAS.bn);
  if (!gris.gris) errores.push(`jirafa-kit-bn.pdf no es escala de grises pura: máx |R−G| ${gris.maxRG}, |G−B| ${gris.maxGB}`);
  const tamanos = await C.tamanosDeLetra(SALIDAS.pantalla);
  const minPie = reglas.tipografia.estilos.pie.minimo_pt;
  const chicos = tamanos.filter((t) => t.pt < minPie);
  if (chicos.length) errores.push(`tamaños de letra por debajo de ${minPie} pt: ${chicos.map((t) => `${t.fuente} ${t.pt} pt`).join(', ')}`);
  const qr = await C.revisarQr(vol, SALIDAS.pantalla);
  errores.push(...qr.errores);
  if (errores.length) throw new C.ErrorBuild(`kit:\n  - ${errores.join('\n  - ')}`);
  // 5) miniaturas a 150 dpi, una por componente
  const dirPng = path.join(DIR, 'typst');
  fs.rmSync(dirPng, { recursive: true, force: true });
  fs.mkdirSync(dirPng, { recursive: true });
  execFileSync('pdftoppm', ['-r', '150', '-png', SALIDAS.pantalla, path.join(dirPng, 'pag')], { stdio: 'ignore' });
  const componentes = [];
  for (const k of vol.kit.paginas) {
    const crudo = fs.readdirSync(dirPng).find((f) => new RegExp(`^pag-0*${k.pagina}\\.png$`).test(f));
    if (!crudo) throw new C.ErrorBuild(`kit: falta la miniatura de la pág. ${k.pagina} (${k.nombre})`);
    const png = path.join(dirPng, `${k.nombre}.png`);
    await sharp(path.join(dirPng, crudo)).png({ palette: true, quality: 80, compressionLevel: 9 }).toFile(png);
    componentes.push({ ...k, png: `typst/${k.nombre}.png`, bytes: fs.statSync(png).size });
  }
  for (const f of fs.readdirSync(dirPng)) if (/^pag-\d+\.png$/.test(f)) fs.rmSync(path.join(dirPng, f));
  const segundos = (Date.now() - t0) / 1000;
  const manifest = {
    version: 1, generado_con: `typst ${fs.readFileSync(path.join(RAIZ, 'print', 'TYPST_VERSION'), 'utf8').trim()}`, epoch: EPOCH, segundos,
    paginas: vol.paginas, esquemas: vol.kit.esquemas,
    pdfs: Object.fromEntries(Object.entries(SALIDAS).map(([k, p]) => [k, { archivo: path.basename(p), ruta: rel(p), bytes: fs.statSync(p).size, sha256: sha(p), paginas: info[k].pages, tamano: info[k].size }])),
    fuentes: Object.fromEntries(Object.entries(fuentes).map(([k, v]) => [k, v.map((f) => `${f.nombre} emb=${f.emb}`)])),
    gris: { maxRG: gris.maxRG, maxGB: gris.maxGB }, qr: qr.filas, tamanos,
    componentes, avisos: vol.avisos,
  };
  fs.writeFileSync(path.join(DIR, 'manifest-kit.json'), JSON.stringify(manifest, null, 2));
  if (huella) guardar('kit', huella, DIR, [...Object.values(SALIDAS), ...componentes.map((c) => path.join(DIR, c.png))], manifest);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  construirKit().then((m) => {
    log(`✔ ${m.pdfs.pantalla.archivo} (${m.paginas} págs, ${(m.pdfs.pantalla.bytes / 1024 / 1024).toFixed(2)} MB) · ${m.pdfs.bn.archivo} (${(m.pdfs.bn.bytes / 1024 / 1024).toFixed(2)} MB, gris máx |R−G| ${m.gris.maxRG}) · fuentes: ${m.fuentes.pantalla.join(', ')} · ${m.componentes.length} miniaturas en print/build/kit/typst/ (${m.segundos.toFixed(1)} s)`);
    for (const a of m.avisos) log(`  ⚠ ${a}`);
  }).catch((e) => { console.error(`✖ ${e instanceof C.ErrorBuild ? e.message : e.stack ?? e}`); process.exit(1); });
}
