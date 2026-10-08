// Mantiene docs/IMPRESO.md sincronizado con print/reglas.json (única fuente
// de las medidas). Las tablas de la sección "Reglas" se GENERAN desde el
// JSON entre los marcadores <!-- reglas:inicio --> y <!-- reglas:fin -->.
//   node scripts/print/check-reglas.mjs           → compara; sale 1 si difieren
//   node scripts/print/check-reglas.mjs --write   → reescribe las tablas
// También valida el JSON (coherencia interna: bleedbox = corte + 2·sangrado,
// caja = corte − márgenes, mínimos de letra, múltiplo de 4, …).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, reglas, revisarPaginas, cuadernillo, paginasFijas } from './lib/reglas.mjs';

const DOC = path.join(RAIZ, 'docs', 'IMPRESO.md');
const INICIO = '<!-- reglas:inicio -->';
const FIN = '<!-- reglas:fin -->';

function validar(r) {
  const e = [];
  const F = r.formato, M = r.margenes, T = r.tipografia.estilos;
  const ig = (a, b, q) => { if (a !== b) e.push(`${q}: ${a} ≠ ${b}`); };
  ig(F.bleedbox.ancho_pt, F.corte.ancho_pt + 2 * F.sangrado_pt, 'bleedbox.ancho');
  ig(F.bleedbox.alto_pt, F.corte.alto_pt + 2 * F.sangrado_pt, 'bleedbox.alto');
  ig(F.mediabox_imprenta.ancho_pt, F.corte.ancho_pt + 2 * F.mediabox_imprenta.offset_trim_pt, 'mediabox.ancho');
  ig(F.mediabox_imprenta.alto_pt, F.corte.alto_pt + 2 * F.mediabox_imprenta.offset_trim_pt, 'mediabox.alto');
  ig(F.mediabox_imprenta.offset_bleed_pt, F.mediabox_imprenta.offset_trim_pt - F.sangrado_pt, 'offset_bleed');
  ig(F.marcas_corte.inicio_desde_corte_pt, F.sangrado_pt, 'marcas_corte.inicio (= sangrado: fuera del BleedBox)');
  ig(F.marcas_corte.largo_pt + F.marcas_corte.inicio_desde_corte_pt, F.mediabox_imprenta.offset_trim_pt, 'marcas de corte caben en la hoja');
  ig(F.corte.ancho_pt / 72, F.corte.ancho_in, 'corte.ancho_in');
  ig(F.corte.alto_pt / 72, F.corte.alto_in, 'corte.alto_in');
  ig(F.sangrado_pt / 72, F.sangrado_in, 'sangrado_in');
  ig(F.pantalla.ancho_pt, F.corte.ancho_pt, 'pantalla.ancho'); ig(F.pantalla.alto_pt, F.corte.alto_pt, 'pantalla.alto');
  ig(r.bn.ancho_pt, F.corte.ancho_pt, 'bn.ancho'); ig(r.bn.alto_pt, F.corte.alto_pt, 'bn.alto');
  ig(F.cuadernillo.hoja_ancho_pt, F.corte.ancho_pt * F.cuadernillo.paginas_por_cara, 'cuadernillo.hoja_ancho');
  ig(F.cuadernillo.hoja_alto_pt, F.corte.alto_pt, 'cuadernillo.hoja_alto');
  ig(M.caja_texto.ancho_pt, F.corte.ancho_pt - M.exterior_pt - M.interior_pt, 'caja_texto.ancho');
  ig(M.caja_texto.alto_pt, F.corte.alto_pt - M.superior_pt - M.inferior_pt, 'caja_texto.alto');
  ig(M.caja_texto.ancho_pt / 72, M.caja_texto.ancho_in, 'caja_texto.ancho_in');
  ig(M.caja_texto.alto_pt / 72, M.caja_texto.alto_in, 'caja_texto.alto_in');
  ig(M.zona_segura_pt / 72, M.zona_segura_in, 'zona_segura_in');
  ig(r.tipografia.medida.ancho_columna_pt, M.caja_texto.ancho_pt, 'medida.ancho_columna');
  if (M.lomo_minimo_pt > M.interior_pt) e.push('lomo_minimo > margen interior');
  for (const [k, s] of Object.entries(T)) {
    if (s.pt < s.minimo_pt) e.push(`estilo ${k}: ${s.pt} pt < mínimo ${s.minimo_pt}`);
  }
  if (T.cuerpo_1col.minimo_pt < 9 || T.cuerpo_2col.minimo_pt < 9) e.push('mínimo de cuerpo < 9 pt');
  if (T.pie.minimo_pt < 7) e.push('mínimo de pies < 7 pt');
  ig(T.folio.pt, r.folio.pt, 'folio.pt'); ig(T.calado.pt, r.prueba.calado_pt, 'calado.pt');
  if (r.paginas.multiplo !== 4) e.push('paginas.multiplo ≠ 4');
  const rp = revisarPaginas(r.paginas.ejemplo_total);
  if (!rp.ok) e.push(`ejemplo_total: ${rp.errores.join('; ')}`);
  ig(r.imagenes.portada_px_minimo_300ppi, Math.ceil(r.imagenes.portada_sangre_in.alto * r.imagenes.ppi_objetivo), 'portada_px_minimo');
  ig(r.imagenes.portada_sangre_in.ancho, F.corte.ancho_in + 2 * F.sangrado_in, 'portada_sangre.ancho');
  ig(r.imagenes.portada_sangre_in.alto, F.corte.alto_in + 2 * F.sangrado_in, 'portada_sangre.alto');
  if (r.tipografia.escalar_texto !== false) e.push('escalar_texto debe ser false');
  return e;
}

const tabla = (cab, filas) => ['| ' + cab.join(' | ') + ' |', '|' + cab.map(() => '---').join('|') + '|', ...filas.map((f) => '| ' + f.join(' | ') + ' |')].join('\n');
const mm = (pt) => (pt * 25.4 / 72).toFixed(2);
const inch = (pt) => +(pt / 72).toFixed(4);

export function generarTablas(r) {
  const F = r.formato, M = r.margenes, T = r.tipografia, Fo = r.folio, I = r.imagenes, B = r.bn, Pg = r.paginas, Pr = r.prueba;
  const N = Pg.ejemplo_total;
  const fijas = paginasFijas(N);
  const partes = [];
  partes.push('### 1. Formato\n');
  partes.push(tabla(['Elemento', 'pt', 'in', 'mm', 'Nota'], [
    ['Corte (TrimBox), vertical', `${F.corte.ancho_pt} × ${F.corte.alto_pt}`, `${F.corte.ancho_in} × ${F.corte.alto_in}`, `${mm(F.corte.ancho_pt)} × ${mm(F.corte.alto_pt)}`, F.corte.orientacion],
    ['Sangrado (por lado)', `${F.sangrado_pt}`, `${F.sangrado_in}`, mm(F.sangrado_pt), `BleedBox ${F.bleedbox.ancho_pt} × ${F.bleedbox.alto_pt} pt`],
    ['Hoja de imprenta (MediaBox)', `${F.mediabox_imprenta.ancho_pt} × ${F.mediabox_imprenta.alto_pt}`, `${F.mediabox_imprenta.ancho_in} × ${F.mediabox_imprenta.alto_in}`, `${mm(F.mediabox_imprenta.ancho_pt)} × ${mm(F.mediabox_imprenta.alto_pt)}`, `TrimBox a ${F.mediabox_imprenta.offset_trim_pt} pt del borde; BleedBox a ${F.mediabox_imprenta.offset_bleed_pt} pt`],
    ['Marcas de corte', `grosor ${F.marcas_corte.grosor_pt}, largo ${F.marcas_corte.largo_pt}`, `${inch(F.marcas_corte.largo_pt)} (largo)`, mm(F.marcas_corte.largo_pt), `${F.marcas_corte.nota}; sólo en la variante imprenta`],
    ['Pantalla / B/N (MediaBox)', `${F.pantalla.ancho_pt} × ${F.pantalla.alto_pt}`, `${F.corte.ancho_in} × ${F.corte.alto_in}`, `${mm(F.pantalla.ancho_pt)} × ${mm(F.pantalla.alto_pt)}`, 'sin sangrado ni marcas'],
    ['Cuadernillo (hoja física)', `${F.cuadernillo.hoja_ancho_pt} × ${F.cuadernillo.hoja_alto_pt}`, `${inch(F.cuadernillo.hoja_ancho_pt)} × ${inch(F.cuadernillo.hoja_alto_pt)}`, `${mm(F.cuadernillo.hoja_ancho_pt)} × ${mm(F.cuadernillo.hoja_alto_pt)}`, `${F.cuadernillo.hoja}, ${F.cuadernillo.paginas_por_cara} páginas por cara, doble cara, voltear por el ${F.cuadernillo.voltear_por}`],
  ]));
  partes.push('\n### 2. Páginas\n');
  partes.push(tabla(['Regla', 'Valor'], [
    ['Total N', `múltiplo de ${Pg.multiplo}; mínimo ${Pg.minimo}; recomendado ${Pg.recomendado_min}–${Pg.recomendado_max}; más de ${Pg.aviso_mas_de} → aviso (no falla); tope: ${Pg.tope === null ? 'ninguno' : Pg.tope}`],
    ['Portada', `${Pg.fijas.portada}`], ['Índice', `${Pg.fijas.indice}`], ['Piezas', Pg.piezas], ['Fin', Pg.fijas.fin], ['Contraportada', Pg.fijas.contraportada],
    ['Pliego central', Pg.pliego_central], ['Relleno', Pg.relleno],
    [`Ejemplo N = ${N}`, `portada ${fijas.portada}, índice ${fijas.indice}, piezas ${fijas.piezas[0]}–${fijas.piezas[1]}, pliego central ${fijas.pliegoCentral[0]}–${fijas.pliegoCentral[1]}, Fin ${fijas.fin}, contraportada ${fijas.contraportada}`],
  ]));
  partes.push(`\nOrden de impresión del cuadernillo para N = ${N} (hoja: frente | vuelta; cada cara lleva dos páginas, izquierda | derecha):\n`);
  partes.push(tabla(['Hoja', 'Frente', 'Vuelta'], cuadernillo(N).map((h) => [`${h.hoja}`, `${h.frente[0]} \\| ${h.frente[1]}`, `${h.vuelta[0]} \\| ${h.vuelta[1]}`])));
  partes.push('\n### 3. Márgenes\n');
  partes.push(tabla(['Margen', 'pt', 'in', 'mm'], [
    ['Superior', `${M.superior_pt}`, `${inch(M.superior_pt)}`, mm(M.superior_pt)],
    ['Inferior', `${M.inferior_pt}`, `${inch(M.inferior_pt)}`, mm(M.inferior_pt)],
    ['Exterior', `${M.exterior_pt}`, `${inch(M.exterior_pt)}`, mm(M.exterior_pt)],
    ['Interior (lomo)', `${M.interior_pt}`, `${inch(M.interior_pt)}`, mm(M.interior_pt)],
    ['Caja de texto', `${M.caja_texto.ancho_pt} × ${M.caja_texto.alto_pt}`, `${M.caja_texto.ancho_in} × ${M.caja_texto.alto_in}`, `${mm(M.caja_texto.ancho_pt)} × ${mm(M.caja_texto.alto_pt)}`],
    ['Zona segura (desde el corte)', `${M.zona_segura_pt}`, `${M.zona_segura_in}`, mm(M.zona_segura_pt)],
    ['Lomo mínimo', `${M.lomo_minimo_pt}`, `${inch(M.lomo_minimo_pt)}`, mm(M.lomo_minimo_pt)],
  ]));
  partes.push(`\nEncuadernación: \`binding: ${M.binding}\`. ${M.recto_verso}. Creep: ${M.creep}.`);
  partes.push('\n### 4. Tipografía\n');
  partes.push(`Fuentes: títulos **${T.fuentes.titulos}**, texto **${T.fuentes.texto}** (${T.fuentes.variantes_texto.join(', ')}). Alineación: ${T.alineacion}. Idioma \`${T.lang}\`, guiones: ${T.guiones ? 'sí' : 'no'}. Escalar texto para que quepa: **${T.escalar_texto ? 'sí' : 'nunca'}** (${T.nota}).\n`);
  partes.push(tabla(['Estilo', 'Uso', 'Fuente', 'Tamaño (pt)', 'Interlínea', 'Mínimo (pt)'], Object.entries(T.estilos).map(([k, s]) => [
    `\`${k}\``, s.uso, `${s.fuente} ${s.peso}`, s.pt_max ? `${s.pt}–${s.pt_max}` : `${s.pt}`,
    s.interlinea_pt != null ? `${s.interlinea_pt} pt` : s.interlinea_factor != null ? `× ${s.interlinea_factor}` : '—', `${s.minimo_pt}`,
  ])));
  partes.push(`\nMedida: ${T.medida.caracteres_por_linea} caracteres por línea (máximo ${T.medida.maximo_caracteres}) en ${T.medida.ancho_columna_pt} pt. Columnas: máximo ${T.columnas.maximo}, separación ${T.columnas.separacion_pt} pt, ancho mínimo ${T.columnas.ancho_minimo_pt} pt; las ${T.columnas.tres_en_web_se_imprimen_en + 1} columnas de la web se imprimen en ${T.columnas.tres_en_web_se_imprimen_en}. Viudas y huérfanas: ${T.viudas_huerfanas}.`);
  partes.push('\n### 5. Folio\n');
  partes.push(tabla(['Regla', 'Valor'], [
    ['Fuente', `${Fo.fuente} ${Fo.peso}, ${Fo.pt} pt, ${Fo.digitos} dígitos (01, 02, …)`],
    ['Posición', `${Fo.alineacion}; línea base a ${Fo.linea_base_desde_corte_inferior_pt} pt (${mm(Fo.linea_base_desde_corte_inferior_pt)} mm) del corte inferior`],
    ['Visible en', Fo.visible_en],
    ['Sobre fotos a sangre', Fo.pestana_blanca_sobre_sangre ? `pestaña blanca sólida, relleno ${Fo.pestana_relleno_pt} pt` : 'sin pestaña'],
  ]));
  partes.push('\n### 6. Imágenes\n');
  partes.push(tabla(['Regla', 'Valor'], [
    ['Resolución objetivo', `${I.ppi_objetivo} ppi al tamaño impreso`],
    ['Advertencia', `${I.ppi_advertencia_desde}–${I.ppi_advertencia_hasta} ppi`],
    ['Error', `menos de ${I.ppi_error_menor_a} ppi`],
    ['Variante pantalla', `${I.pantalla_ppi} ppi, JPEG calidad ${I.pantalla_jpeg_calidad}`],
    ['Portada a sangre', `${I.portada_sangre_in.ancho} × ${I.portada_sangre_in.alto} in → mínimo ${I.portada_px_minimo_300ppi} px de alto (recomendado ${I.portada_px_recomendado})`],
    ['Formatos', I.formatos.join(', ')], ['Color', I.color], ['Texturas', I.texturas], ['Originales', I.originales],
  ]));
  partes.push('\n### 7. Blanco y negro (fotocopia)\n');
  partes.push(tabla(['Regla', 'Valor'], [
    ['Esquema', B.esquema], ['Punto negro / blanco', `${B.punto_negro_pct} % / ${B.punto_blanco_pct} %`], ['Gamma', `${B.gamma}`],
    ['Fondo gris mínimo', `${B.gris_minimo_fondo_pct} % (menos desaparece en la copia)`], ['Negro sólido', `como máximo ${B.negro_solido_max_pct_pagina} % de la página`],
    ['Texto sobre', B.texto_sobre], ['Hoja', `${B.ancho_pt} × ${B.alto_pt} pt, sin sangrado ni marcas`],
  ]));
  partes.push('\n### Hoja de prueba (`print/prueba.typ`)\n');
  partes.push(tabla(['Elemento', 'Valor'], [
    ['Muestras Space Mono', Pr.muestras_space_mono_pt.map((p) => `${p} pt`).join(', ')],
    ['Muestras Anton', Pr.muestras_anton_pt.map((p) => `${p} pt`).join(', ')],
    ['Cadena de prueba', `\`${Pr.cadena}\``], ['Calado', `${Pr.calado_pt} pt`],
    ['QR', `${Pr.qr_in} in → ${Pr.qr_url}`],
    ['Foto de muestra', `${Pr.foto}, ${Pr.foto_lado_in} × ${Pr.foto_lado_in} in a ${I.ppi_objetivo} y ${I.ppi_error_menor_a} ppi`],
    ['Escala de grises', `0–100 % en pasos de ${Pr.grises_paso_pct} %`], ['Páginas', `${Pr.paginas} (folio en 2 … ${Pr.paginas - 1})`],
    ['Doble cara', `cruces a ${Pr.doble_cara_cruz_margen_pt} pt de cada borde, ${Pr.doble_cara_cruz_largo_pt} pt de largo`],
  ]));
  return `${INICIO}\n<!-- GENERADO desde print/reglas.json (v${r.version}) con \`npm run print:check -- --write\`. No editar a mano. -->\n\n${partes.join('\n')}\n\n${FIN}`;
}

// Criterio 2: ningún .typ escribe a mano medidas de formato, márgenes ni
// tamaños de letra (todo sale de reglas.json vía pt()/inch()).
const PATRONES_A_MANO = [
  /\bsize:\s*[0-9]/, // tamaños de letra literales
  /\b(margin|inside|outside|paper|leading):\s*[1-9]/, // márgenes/hoja literales
  /\b(396|612|414|630|450|666|792|9\.5|13\.5|7\.5|12\.5)\s*(pt|in)\b/, // medidas clave del formato
  /\b(width|height):\s*(396|612|450|666|792|414|630|5\.5|8\.5)(pt|in)\b/,
];
export function medidasAMano() {
  const hits = [];
  const dir = path.join(RAIZ, 'print');
  const typ = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? typ(path.join(d, e.name)) : e.name.endsWith('.typ') ? [path.join(d, e.name)] : []);
  for (const f of typ(dir)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const sinComentario = l.replace(/\/\/.*$/, '');
      if (PATRONES_A_MANO.some((re) => re.test(sinComentario))) hits.push(`${path.relative(RAIZ, f)}:${i + 1}: ${l.trim()}`);
    });
  }
  return hits;
}

const errores = validar(reglas);
const aMano = medidasAMano();
if (aMano.length) errores.push(`medidas escritas a mano en .typ:\n    ${aMano.join('\n    ')}`);
if (errores.length) {
  console.error('✖ print/reglas.json incoherente:\n  - ' + errores.join('\n  - '));
  process.exit(1);
}
console.log(`✔ print/reglas.json v${reglas.version}: coherente`);

const doc = fs.readFileSync(DOC, 'utf8');
const a = doc.indexOf(INICIO), b = doc.indexOf(FIN);
if (a < 0 || b < 0 || b < a) { console.error(`✖ ${path.relative(RAIZ, DOC)}: faltan los marcadores ${INICIO} / ${FIN}`); process.exit(1); }
const actual = doc.slice(a, b + FIN.length);
const nuevo = generarTablas(reglas);
if (process.argv.includes('--write')) {
  fs.writeFileSync(DOC, doc.slice(0, a) + nuevo + doc.slice(b + FIN.length));
  console.log(`✔ ${path.relative(RAIZ, DOC)}: tablas reescritas desde reglas.json`);
} else if (actual !== nuevo) {
  console.error(`✖ ${path.relative(RAIZ, DOC)}: las tablas no coinciden con print/reglas.json. Corré: npm run print:check -- --write`);
  const la = actual.split('\n'), ln = nuevo.split('\n');
  for (let i = 0; i < Math.max(la.length, ln.length); i++) {
    if (la[i] !== ln[i]) { console.error(`  primera diferencia (línea ${i + 1} del bloque):\n    doc:    ${la[i]}\n    reglas: ${ln[i]}`); break; }
  }
  process.exit(1);
} else {
  console.log(`✔ ${path.relative(RAIZ, DOC)}: tablas iguales a print/reglas.json`);
}
