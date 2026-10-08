// Build del impreso de los volúmenes (issue #9):
//   npm run print                       → todos los volúmenes publicables
//   node scripts/print/build.mjs --fixture tests/print/fixtures/x.mdx   → un fixture
//   node scripts/print/build.mjs --dos-veces                           → compila 2 veces y compara sha256
// Pasos por volumen: export (tsx) → variantes (sharp) → typst compile
// pantalla e imprenta → TrimBox/BleedBox (pdf-lib) → chequeos (check.mjs)
// → print/build/manifest.json + print/build/resumen.md (para el job summary).
// Determinista: --creation-timestamp SOURCE_DATE_EPOCH (= fecha del último
// commit si no está puesta).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { RAIZ, reglas, revisarPaginas } from './lib/reglas.mjs';
import { typstBin, verificarFuentes, compilar, cajasImprenta } from './build-prueba.mjs';
import { variantes } from './variantes.mjs';
import * as C from './check.mjs';

const BUILD = path.join(RAIZ, 'print', 'build');
const args = process.argv.slice(2);
const fixture = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const dosVeces = args.includes('--dos-veces');
const quiet = args.includes('--quiet');
const log = (...a) => { if (!quiet) console.log(...a); };

function epoch() {
  if (process.env.SOURCE_DATE_EPOCH) return process.env.SOURCE_DATE_EPOCH;
  const r = spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: RAIZ, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : '0';
}
const EPOCH = epoch();
process.env.SOURCE_DATE_EPOCH = EPOCH;

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** Export a JSON (tsx). Devuelve las rutas de los volumen.json escritos. */
function exportar() {
  const a = ['tsx', path.join(RAIZ, 'scripts', 'print', 'export.ts')];
  if (fixture) a.push('--fixture', fixture, '--salida', path.join(BUILD, 'fixtures', path.basename(fixture, '.mdx')));
  const r = spawnSync('npx', a, { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new C.ErrorBuild((r.stderr || r.stdout).trim());
  log(r.stdout.trim());
  return [...r.stdout.matchAll(/→ (\S+volumen\.json)/g)].map((m) => path.join(RAIZ, m[1]));
}

async function construirVolumen(bin, jsonPath) {
  const dir = path.dirname(jsonPath);
  const { vol, informe } = await variantes(jsonPath);
  const slug = vol.slug;
  const jsonRel = '/' + rel(jsonPath);
  const pdfs = {};
  const avisos = [...vol.avisos];
  const errores = [];
  for (const variante of ['pantalla', 'imprenta']) {
    const salida = path.join(dir, `jirafa-${slug}-${variante}.pdf`);
    const r = spawnSync(bin, ['compile', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--creation-timestamp', EPOCH, '--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'volumen.typ'), salida], { cwd: RAIZ, encoding: 'utf8' });
    if (r.status !== 0) {
      // Un panic de Typst (tamaño mínimo, componente sin gemelo) llega acá con su mensaje.
      const msg = r.stderr.replace(/\x1b\[[0-9;]*m/g, '').trim();
      throw new C.ErrorBuild(`${slug} (${variante}): Typst falló:\n${msg}`);
    }
    if (variante === 'imprenta') await cajasImprenta(salida);
    pdfs[variante] = salida;
  }
  // ── Chequeos ──────────────────────────────────────────────────────────
  const reales = C.paginasReales(bin, jsonRel, 'pantalla');
  errores.push(...C.revisarDesbordes(vol, reales));
  if (errores.length) throw new C.ErrorBuild(`${slug}: ${errores.join('\n')}`);
  const indice = C.revisarIndice(vol, reales);
  errores.push(...indice.errores);
  const infoP = C.pdfinfo(pdfs.pantalla), infoI = C.pdfinfo(pdfs.imprenta);
  const F = reglas.formato, mb = F.mediabox_imprenta;
  const cajas = await C.revisarCajas(pdfs.imprenta, {
    media: [0, 0, mb.ancho_pt, mb.alto_pt],
    trim: [mb.offset_trim_pt, mb.offset_trim_pt, mb.offset_trim_pt + F.corte.ancho_pt, mb.offset_trim_pt + F.corte.alto_pt],
    bleed: [mb.offset_bleed_pt, mb.offset_bleed_pt, mb.offset_bleed_pt + F.bleedbox.ancho_pt, mb.offset_bleed_pt + F.bleedbox.alto_pt],
  });
  if (cajas.malas.length) errores.push(`imprenta: páginas sin las cajas esperadas: ${cajas.malas.join(', ')}`);
  if (infoP.pages !== vol.paginas || infoI.pages !== vol.paginas) errores.push(`páginas: pantalla ${infoP.pages}, imprenta ${infoI.pages}, esperadas ${vol.paginas}`);
  if (infoP.size !== `${F.pantalla.ancho_pt} x ${F.pantalla.alto_pt} pts`) errores.push(`pantalla: tamaño ${infoP.size}`);
  const mapa = C.revisarMapa(vol, pdfs.pantalla);
  errores.push(...mapa.errores);
  const fuentes = {};
  for (const [k, p] of Object.entries(pdfs)) {
    fuentes[k] = C.pdffonts(p);
    const raras = fuentes[k].filter((f) => !/^(Anton|SpaceMono)-/.test(f.nombre) || f.emb !== 'yes');
    if (raras.length) errores.push(`${k}: fuentes no permitidas o sin embeber: ${raras.map((f) => f.nombre).join(', ')}`);
  }
  const ligasP = await C.ligasYMarcadores(pdfs.pantalla), ligasI = await C.ligasYMarcadores(pdfs.imprenta);
  if (ligasI.links !== 0) errores.push(`imprenta: ${ligasI.links} anotaciones /Link (deben ser 0)`);
  if (ligasP.links === 0) errores.push('pantalla: sin ligas internas en el índice');
  if (ligasP.marcadores === 0) avisos.push('pantalla: sin marcadores (bookmarks)');
  const tamanos = await C.tamanosDeLetra(pdfs.imprenta);
  const minPie = reglas.tipografia.estilos.pie.minimo_pt;
  const chicos = tamanos.filter((t) => t.pt < minPie);
  if (chicos.length) errores.push(`tamaños de letra por debajo de ${minPie} pt: ${chicos.map((t) => `${t.fuente} ${t.pt} pt`).join(', ')}`);
  const ppi = C.revisarPpi(vol);
  errores.push(...ppi.errores); avisos.push(...ppi.avisos);
  const qr = vol.multimedia === 'qr' ? await C.revisarQr(vol, pdfs.imprenta) : { filas: [], errores: [] };
  errores.push(...qr.errores);
  const pesoP = C.pesoMB(pdfs.pantalla), pesoI = C.pesoMB(pdfs.imprenta);
  if (pesoP > 5) errores.push(`pantalla pesa ${pesoP.toFixed(2)} MB (> 5 MB)`);
  const rp = revisarPaginas(vol.paginas);
  avisos.push(...rp.avisos);
  if (errores.length) throw new C.ErrorBuild(`${slug}:\n  - ${errores.join('\n  - ')}`);

  let determinismo = null;
  if (dosVeces) {
    const antes = { pantalla: sha(pdfs.pantalla), imprenta: sha(pdfs.imprenta) };
    for (const variante of ['pantalla', 'imprenta']) {
      const tmp = path.join(dir, `.otra-${variante}.pdf`);
      compilar(bin, path.join(RAIZ, 'print', 'volumen.typ'), tmp, null, ['--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`]);
      if (variante === 'imprenta') await cajasImprenta(tmp);
      determinismo = { ...(determinismo ?? {}), [variante]: { a: antes[variante], b: sha(tmp), igual: antes[variante] === sha(tmp) } };
      fs.rmSync(tmp);
    }
    if (!Object.values(determinismo).every((d) => d.igual)) throw new C.ErrorBuild(`${slug}: dos compilaciones dan PDFs distintos`);
  }
  const ppiMin = Math.min(...ppi.filas.map((f) => f.ppi).filter((x) => x != null), Infinity);
  return {
    slug, volumen: vol.volumen, titulo: vol.titulo, paginas: vol.paginas, prueba: vol.prueba, multimedia: vol.multimedia, url: vol.url,
    pdfs: {
      pantalla: { archivo: `jirafa-${slug}-pantalla.pdf`, ruta: rel(pdfs.pantalla), bytes: fs.statSync(pdfs.pantalla).size, sha256: sha(pdfs.pantalla), paginas: infoP.pages, tamano: infoP.size },
      imprenta: { archivo: `jirafa-${slug}-imprenta.pdf`, ruta: rel(pdfs.imprenta), bytes: fs.statSync(pdfs.imprenta).size, sha256: sha(pdfs.imprenta), paginas: infoI.pages, tamano: infoI.size, mediabox: infoI.media, trimbox: infoI.trim, bleedbox: infoI.bleed },
    },
    ppi_min: Number.isFinite(ppiMin) ? ppiMin : null,
    ligas: { pantalla: ligasP, imprenta: ligasI },
    fuentes: Object.fromEntries(Object.entries(fuentes).map(([k, v]) => [k, v.map((f) => `${f.nombre} emb=${f.emb}`)])),
    tamanos, indice: indice.filas, mapa: mapa.filas, fotos: ppi.filas, qr: qr.filas, determinismo, avisos,
  };
}

function resumenMd(resultados, segundos) {
  const l = [];
  l.push(`## Impreso (Typst ${fs.readFileSync(path.join(RAIZ, 'print', 'TYPST_VERSION'), 'utf8').trim()}) — ${resultados.length} volumen(es), ${segundos.toFixed(1)} s, SOURCE_DATE_EPOCH=${EPOCH}`, '');
  l.push('| Archivo | Páginas | Hoja | Cajas (imprenta) | ppi mínimo | Peso | Avisos |', '|---|---|---|---|---|---|---|');
  for (const r of resultados) {
    const i = r.pdfs.imprenta;
    l.push(`| ${r.pdfs.pantalla.archivo} | ${r.pdfs.pantalla.paginas} | ${r.pdfs.pantalla.tamano} | — | ${r.ppi_min ?? '—'} | ${(r.pdfs.pantalla.bytes / 1024 / 1024).toFixed(2)} MB | ${r.avisos.length} |`);
    l.push(`| ${i.archivo} | ${i.paginas} | ${i.tamano} | Trim ${i.trimbox.join(' ')} · Bleed ${i.bleedbox.join(' ')} | ${r.ppi_min ?? '—'} | ${(i.bytes / 1024 / 1024).toFixed(2)} MB | ${r.avisos.length} |`);
  }
  for (const r of resultados) {
    l.push('', `### ${r.slug}: fotos (ppi efectivo en imprenta)`, '', '| Pág. | Componente | Foto | px | Ancho (pt) | ppi | Estado |', '|---|---|---|---|---|---|---|');
    for (const f of r.fotos) l.push(`| ${f.pliego} | ${f.componente} | ${f.foto} | ${f.px} | ${f.ancho_pt} | ${f.ppi} | ${f.estado} |`);
    l.push('', `Tamaños de letra (imprenta): ${r.tamanos.map((t) => `${t.fuente} ${t.pt} pt (${t.usos})`).join(', ')}`);
    if (r.avisos.length) l.push('', '**Avisos**', '', ...r.avisos.map((a) => `- ${a}`));
  }
  return l.join('\n') + '\n';
}

async function main() {
  const t0 = Date.now();
  const bin = typstBin();
  verificarFuentes();
  fs.mkdirSync(BUILD, { recursive: true });
  const jsons = exportar();
  const resultados = [];
  for (const j of jsons) {
    const r = await construirVolumen(bin, j);
    resultados.push(r);
    log(`✔ ${r.slug}: ${r.pdfs.pantalla.archivo} (${r.pdfs.pantalla.paginas} págs, ${(r.pdfs.pantalla.bytes / 1024 / 1024).toFixed(2)} MB) · ${r.pdfs.imprenta.archivo} (${(r.pdfs.imprenta.bytes / 1024 / 1024).toFixed(2)} MB) · ppi mín ${r.ppi_min ?? '—'} · ligas pantalla ${r.ligas.pantalla.links}, imprenta ${r.ligas.imprenta.links} · marcadores ${r.ligas.pantalla.marcadores}`);
    for (const a of r.avisos) log(`  ⚠ ${a}`);
  }
  const segundos = (Date.now() - t0) / 1000;
  if (!fixture) {
    const manifest = { version: 1, generado_con: `typst ${fs.readFileSync(path.join(RAIZ, 'print', 'TYPST_VERSION'), 'utf8').trim()}`, epoch: EPOCH, segundos, volumenes: resultados };
    fs.writeFileSync(path.join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(BUILD, 'resumen.md'), resumenMd(resultados, segundos));
    log(`✔ print/build/manifest.json y resumen.md (${segundos.toFixed(1)} s)`);
  } else {
    fs.writeFileSync(path.join(BUILD, 'fixtures', path.basename(fixture, '.mdx'), 'resultado.json'), JSON.stringify(resultados[0], null, 2));
  }
}

main().catch((e) => { console.error(`✖ ${e instanceof C.ErrorBuild ? e.message : e.stack ?? e}`); process.exit(1); });
