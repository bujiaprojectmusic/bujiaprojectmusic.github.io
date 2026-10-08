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
import * as Q from './cuadernillo.mjs';

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
  // Variantes: pantalla, imprenta (#9) y xerox = bn (#10).
  for (const variante of ['pantalla', 'imprenta', 'bn']) {
    const nombre = variante === 'bn' ? 'xerox' : variante;
    const salida = path.join(dir, `jirafa-${slug}-${nombre}.pdf`);
    const r = spawnSync(bin, ['compile', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--creation-timestamp', EPOCH, '--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'volumen.typ'), salida], { cwd: RAIZ, encoding: 'utf8' });
    if (r.status !== 0) {
      // Un panic de Typst (tamaño mínimo, componente sin gemelo) llega acá con su mensaje.
      const msg = r.stderr.replace(/\x1b\[[0-9;]*m/g, '').trim();
      throw new C.ErrorBuild(`${slug} (${variante}): Typst falló:\n${msg}`);
    }
    if (variante === 'imprenta') await cajasImprenta(salida);
    pdfs[nombre] = salida;
  }
  // Cuadernillos (#10): carta horizontal, 2 páginas por cara, orden de reglas.mjs.
  pdfs.cuadernillo = path.join(dir, `jirafa-${slug}-cuadernillo.pdf`);
  const impC = await Q.cuadernillo(pdfs.imprenta, pdfs.cuadernillo, 'trim', `La Jirafa Eléctrica Vol. ${vol.volumen} — cuadernillo`);
  pdfs.cuadernilloXerox = path.join(dir, `jirafa-${slug}-cuadernillo-xerox.pdf`);
  const impX = await Q.cuadernillo(pdfs.xerox, pdfs.cuadernilloXerox, 'media', `La Jirafa Eléctrica Vol. ${vol.volumen} — cuadernillo xerox`);
  // Cómo imprimir y engrapar (1 página, aparte del cuadernillo).
  pdfs.comoImprimir = path.join(dir, `jirafa-${slug}-como-imprimir.pdf`);
  {
    const r = spawnSync(bin, ['compile', '--root', RAIZ, '--font-path', path.join(RAIZ, 'print', 'fonts'), '--ignore-system-fonts', '--creation-timestamp', EPOCH, '--input', `volumen=${jsonRel}`, path.join(RAIZ, 'print', 'como-imprimir.typ'), pdfs.comoImprimir], { cwd: RAIZ, encoding: 'utf8' });
    if (r.status !== 0) throw new C.ErrorBuild(`${slug} (como-imprimir): Typst falló:\n${r.stderr.replace(/\x1b\[[0-9;]*m/g, '').trim()}`);
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
  // ── #10: cuadernillo, xerox, tóner, orden, escala ─────────────────────
  const infoC = C.pdfinfo(pdfs.cuadernillo), infoCX = C.pdfinfo(pdfs.cuadernilloXerox), infoX = C.pdfinfo(pdfs.xerox), infoComo = C.pdfinfo(pdfs.comoImprimir);
  const carasEsperadas = impC.total / 2;
  const hojaCarta = `${F.cuadernillo.hoja_ancho_pt} x ${F.cuadernillo.hoja_alto_pt} pts`;
  if (infoC.pages !== carasEsperadas || !infoC.size.startsWith(hojaCarta)) errores.push(`cuadernillo: ${infoC.pages} caras de ${infoC.size} (esperadas ${carasEsperadas} de ${hojaCarta})`);
  if (infoCX.pages !== carasEsperadas || !infoCX.size.startsWith(hojaCarta)) errores.push(`cuadernillo-xerox: ${infoCX.pages} caras de ${infoCX.size}`);
  if (infoX.pages !== vol.paginas || infoX.size !== `${reglas.bn.ancho_pt} x ${reglas.bn.alto_pt} pts`) errores.push(`xerox: ${infoX.pages} páginas de ${infoX.size}`);
  if (infoComo.pages !== 1) errores.push(`como-imprimir: ${infoComo.pages} páginas (debe ser 1)`);
  const orden = await Q.verificarOrden(bin, jsonRel, 'imprenta', 'trim', vol.paginas);
  if (!orden.ok) errores.push(`cuadernillo: orden leído ${JSON.stringify(orden.leido)} ≠ esperado ${JSON.stringify(orden.esperado)}`);
  const grisX = await Q.grisesYToner(pdfs.xerox);
  const grisCX = await Q.grisesYToner(pdfs.cuadernilloXerox);
  if (!grisX.gris) errores.push(`xerox no es escala de grises pura: máx |R−G| ${grisX.maxRG}, |G−B| ${grisX.maxGB}`);
  if (!grisCX.gris) errores.push(`cuadernillo-xerox no es escala de grises pura: máx |R−G| ${grisCX.maxRG}, |G−B| ${grisCX.maxGB}`);
  const tonerMax = reglas.bn.negro_solido_max_pct_pagina;
  for (const t of grisX.toner) if (t.pct > tonerMax) avisos.push(`xerox pág. ${t.pagina}: ${t.pct} % de negro sólido (más de ${tonerMax} %).`);
  const ppiC = Q.ppiEmbebidas(pdfs.cuadernillo);
  if (ppiC.ppi_min != null && ppiC.ppi_min < reglas.imagenes.ppi_objetivo) avisos.push(`cuadernillo: imagen embebida a ${ppiC.ppi_min} ppi (pdfimages -list).`);
  const escala = await Q.escalaCuadernillo(pdfs.cuadernillo);
  if (!escala.escala1) errores.push(`cuadernillo: páginas reescaladas (cm ${JSON.stringify(escala.cm)})`);
  for (const k of ['cuadernillo', 'cuadernilloXerox', 'xerox', 'comoImprimir']) {
    fuentes[k] = C.pdffonts(pdfs[k]);
    const raras = fuentes[k].filter((f) => !/^(Anton|SpaceMono)-/.test(f.nombre) || f.emb !== 'yes');
    if (raras.length) errores.push(`${k}: fuentes no permitidas o sin embeber: ${raras.map((f) => f.nombre).join(', ')}`);
  }
  const caras = path.join(dir, `caras-${slug}.png`);
  await Q.miniaturasCaras(pdfs.cuadernillo, caras);
  const rp = revisarPaginas(vol.paginas);
  avisos.push(...rp.avisos);
  if (errores.length) throw new C.ErrorBuild(`${slug}:\n  - ${errores.join('\n  - ')}`);

  let determinismo = null;
  if (dosVeces) {
    const antes = Object.fromEntries(Object.entries(pdfs).map(([k, p]) => [k, sha(p)]));
    const otra = {};
    for (const [variante, nombre] of [['pantalla', 'pantalla'], ['imprenta', 'imprenta'], ['bn', 'xerox']]) {
      const tmp = path.join(dir, `.otra-${nombre}.pdf`);
      compilar(bin, path.join(RAIZ, 'print', 'volumen.typ'), tmp, null, ['--input', `variante=${variante}`, '--input', `volumen=${jsonRel}`]);
      if (variante === 'imprenta') await cajasImprenta(tmp);
      otra[nombre] = tmp;
    }
    otra.cuadernillo = path.join(dir, '.otra-cuadernillo.pdf');
    await Q.cuadernillo(otra.imprenta, otra.cuadernillo, 'trim', `La Jirafa Eléctrica Vol. ${vol.volumen} — cuadernillo`);
    otra.cuadernilloXerox = path.join(dir, '.otra-cuadernillo-xerox.pdf');
    await Q.cuadernillo(otra.xerox, otra.cuadernilloXerox, 'media', `La Jirafa Eléctrica Vol. ${vol.volumen} — cuadernillo xerox`);
    otra.comoImprimir = path.join(dir, '.otra-como.pdf');
    compilar(bin, path.join(RAIZ, 'print', 'como-imprimir.typ'), otra.comoImprimir, null, ['--input', `volumen=${jsonRel}`]);
    determinismo = {};
    for (const [k, tmp] of Object.entries(otra)) { determinismo[k] = { a: antes[k], b: sha(tmp), igual: antes[k] === sha(tmp) }; fs.rmSync(tmp); }
    if (!Object.values(determinismo).every((d) => d.igual)) throw new C.ErrorBuild(`${slug}: dos compilaciones dan PDFs distintos`);
  }
  const ppiMin = Math.min(...ppi.filas.map((f) => f.ppi).filter((x) => x != null), Infinity);
  return {
    slug, volumen: vol.volumen, titulo: vol.titulo, paginas: vol.paginas, prueba: vol.prueba, multimedia: vol.multimedia, url: vol.url,
    pdfs: {
      pantalla: { archivo: `jirafa-${slug}-pantalla.pdf`, ruta: rel(pdfs.pantalla), bytes: fs.statSync(pdfs.pantalla).size, sha256: sha(pdfs.pantalla), paginas: infoP.pages, tamano: infoP.size },
      imprenta: { archivo: `jirafa-${slug}-imprenta.pdf`, ruta: rel(pdfs.imprenta), bytes: fs.statSync(pdfs.imprenta).size, sha256: sha(pdfs.imprenta), paginas: infoI.pages, tamano: infoI.size, mediabox: infoI.media, trimbox: infoI.trim, bleedbox: infoI.bleed },
      cuadernillo: { archivo: `jirafa-${slug}-cuadernillo.pdf`, ruta: rel(pdfs.cuadernillo), bytes: fs.statSync(pdfs.cuadernillo).size, sha256: sha(pdfs.cuadernillo), paginas: infoC.pages, tamano: infoC.size, hojas: infoC.pages / 2 },
      xerox: { archivo: `jirafa-${slug}-xerox.pdf`, ruta: rel(pdfs.xerox), bytes: fs.statSync(pdfs.xerox).size, sha256: sha(pdfs.xerox), paginas: infoX.pages, tamano: infoX.size },
      cuadernilloXerox: { archivo: `jirafa-${slug}-cuadernillo-xerox.pdf`, ruta: rel(pdfs.cuadernilloXerox), bytes: fs.statSync(pdfs.cuadernilloXerox).size, sha256: sha(pdfs.cuadernilloXerox), paginas: infoCX.pages, tamano: infoCX.size, hojas: infoCX.pages / 2 },
      comoImprimir: { archivo: `jirafa-${slug}-como-imprimir.pdf`, ruta: rel(pdfs.comoImprimir), bytes: fs.statSync(pdfs.comoImprimir).size, sha256: sha(pdfs.comoImprimir), paginas: infoComo.pages, tamano: infoComo.size },
    },
    cuadernillo: { caras: impC.caras, total: impC.total, orden: orden, escala: escala, ppi_embebidas: ppiC, miniaturas: rel(caras) },
    xerox: { gris: { maxRG: grisX.maxRG, maxGB: grisX.maxGB }, cuadernillo_gris: { maxRG: grisCX.maxRG, maxGB: grisCX.maxGB }, toner: grisX.toner, toner_max_pct: tonerMax },
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
    for (const k of ['cuadernillo', 'xerox', 'cuadernilloXerox', 'comoImprimir']) {
      const p = r.pdfs[k];
      l.push(`| ${p.archivo} | ${p.paginas}${p.hojas ? ` caras (${p.hojas} hojas)` : ''} | ${p.tamano} | — | ${k === 'cuadernillo' ? (r.cuadernillo.ppi_embebidas.ppi_min ?? '—') : '—'} | ${(p.bytes / 1024 / 1024).toFixed(2)} MB | |`);
    }
  }
  for (const r of resultados) {
    l.push('', `### ${r.slug}: cuadernillo`, '', `Orden de caras (izq | der): ${r.cuadernillo.caras.map((c) => `[${c.map((p) => p ?? '—').join(' | ')}]`).join(' ')} — leído con marcas-prueba: ${r.cuadernillo.orden.ok ? 'coincide ✔' : 'NO coincide ✖'}. Escala 1 (cm): ${r.cuadernillo.escala.cm.map((m) => m.join(' ')).join('; ')}. Imágenes embebidas: ${r.cuadernillo.ppi_embebidas.imagenes}, ppi mínimo ${r.cuadernillo.ppi_embebidas.ppi_min ?? '—'}.`);
    l.push('', `### ${r.slug}: xerox — tóner por página (negro sólido, luma < 20 a 50 dpi; aviso > ${r.xerox.toner_max_pct} %)`, '', '| Pág. | Negro sólido | |', '|---|---|---|');
    for (const t of r.xerox.toner) l.push(`| ${t.pagina} | ${t.pct} % | ${t.pct > r.xerox.toner_max_pct ? '⚠ más de ' + r.xerox.toner_max_pct + ' %' : ''} |`);
    l.push('', `Escala de grises: xerox máx |R−G| ${r.xerox.gris.maxRG}, |G−B| ${r.xerox.gris.maxGB}; cuadernillo-xerox máx |R−G| ${r.xerox.cuadernillo_gris.maxRG}, |G−B| ${r.xerox.cuadernillo_gris.maxGB}.`);
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
    log(`  cuadernillo ${r.pdfs.cuadernillo.paginas} caras (${(r.pdfs.cuadernillo.bytes / 1024 / 1024).toFixed(2)} MB), orden ${r.cuadernillo.orden.ok ? '✔' : '✖'} ${JSON.stringify(r.cuadernillo.caras)} · xerox ${r.pdfs.xerox.paginas} págs gris ✔ (máx |R−G| ${r.xerox.gris.maxRG}) · cuadernillo-xerox ${r.pdfs.cuadernilloXerox.paginas} caras · tóner máx ${Math.max(...r.xerox.toner.map((t) => t.pct))} % · como-imprimir ${r.pdfs.comoImprimir.paginas} pág`);
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
