// Consistencia del registro de componentes (issue #17):
// src/components/fanzine/registro.json ↔ archivos .astro ↔ funciones Typst
// ↔ print/lib/render.typ ↔ COMPONENTES_MDX.md. Corre con npm run print:test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const registro = JSON.parse(leer('src/components/fanzine/registro.json'));
const C = registro.componentes;
const aprobados = C.filter((c) => c.estado === 'aprobado');

test('registro: nombres únicos, estados válidos y campos obligatorios', () => {
  const nombres = C.map((c) => c.nombre);
  assert.equal(new Set(nombres).size, nombres.length, 'nombres repetidos');
  for (const c of C) {
    assert.ok(['aprobado', 'propuesto'].includes(c.estado), `${c.nombre}: estado ${c.estado}`);
    for (const k of ['nombre', 'grupo', 'tipo', 'descripcion', 'props', 'estado', 'soloWeb', 'soloImpreso', 'mdx']) assert.ok(k in c, `${c.nombre}: falta ${k}`);
    assert.ok(Array.isArray(c.props));
  }
});

test('registro: todo aprobado tiene archivo web existente y gemelo Typst (o razón de sólo web)', () => {
  for (const c of aprobados) {
    assert.ok(c.web, `${c.nombre}: sin web`);
    const archivo = c.web.split(' ')[0];
    assert.ok(fs.existsSync(path.join(RAIZ, archivo)), `${c.nombre}: no existe ${archivo}`);
    assert.ok(c.typst || c.soloWeb || c.nombre === 'MissingImage', `${c.nombre}: aprobado sin gemelo Typst ni razón de sólo web`);
    if (c.typst) {
      const [arch, fn] = c.typst.split('#');
      if (arch.endsWith('.typ') && c.tipo !== 'estilo') {
        const src = leer(arch);
        assert.match(src, new RegExp(`#let ${fn.replace(/[-]/g, '\\-')}\\(`), `${c.nombre}: ${c.typst} no define #let ${fn}(`);
      } else assert.ok(fs.existsSync(path.join(RAIZ, arch)), `${c.nombre}: no existe ${arch}`);
    }
  }
});

test('registro: los propuestos no tienen web ni typst y no cuentan como gemelos', () => {
  for (const c of C.filter((c) => c.estado === 'propuesto')) {
    assert.equal(c.web, null, `${c.nombre}: propuesto con web`);
    assert.equal(c.typst, null, `${c.nombre}: propuesto con typst`);
  }
});

test('registro ↔ render.typ: todo componente con gemelo en componentes/ está en el mapa `gemelos` (o es página / se resuelve en el export)', () => {
  const render = leer('print/lib/render.typ');
  const mapa = [...render.matchAll(/^\s{2}([A-Z][A-Za-z]+):\s*([a-z-]+),/gm)].map((m) => [m[1], m[2]]);
  const enMapa = new Map(mapa);
  const porExport = new Set(['VideoOldTV', 'VideoCinema', 'Playlist', 'Foto']); // llegan como VideoPoster / ImageFull… desde export.ts / piezas.ts
  const paginas = new Set(['Pliego', 'Pagina', 'Relleno', 'Portada', 'Indice', 'Contraportada']);
  const estilos = new Set(C.filter((c) => c.tipo === 'estilo').map((c) => c.nombre));
  for (const c of aprobados.filter((c) => c.typst)) {
    if (porExport.has(c.nombre) || paginas.has(c.nombre) || estilos.has(c.nombre)) continue;
    assert.ok(enMapa.has(c.nombre), `${c.nombre}: no está en gemelos de print/lib/render.typ`);
    assert.equal(enMapa.get(c.nombre), c.typst.split('#')[1], `${c.nombre}: render.typ apunta a ${enMapa.get(c.nombre)}`);
  }
  for (const [nombre] of mapa) assert.ok(C.some((c) => c.nombre === nombre && c.estado === 'aprobado'), `render.typ tiene ${nombre}, que no está aprobado en el registro`);
});

test('registro ↔ COMPONENTES_MDX.md: cada componente aparece en la tabla del catálogo', () => {
  const docs = leer('COMPONENTES_MDX.md');
  const faltan = C.filter((c) => !new RegExp(`\\|\\s*\`${c.nombre}\`\\s*\\|`).test(docs)).map((c) => c.nombre);
  assert.deepEqual(faltan, [], `faltan en COMPONENTES_MDX.md: ${faltan.join(', ')}`);
});

test('registro: el inventario del issue #17 está completo', () => {
  const inventario = ['Portada', 'Indice', 'Contraportada', 'SectionTitle', 'Columnas', 'Polaroid', 'PostCover', 'ImageFull', 'ImageSide', 'PhotoOld', 'Xerox', 'Gallery', 'BeforeAfter', 'Divider', 'Quote', 'Note', 'VideoOldTV', 'VideoCinema', 'Encabezados', 'StickerTitle', 'SectionLabel', 'PunkButton', 'BackToTop', 'Pliego', 'Sticker', 'Cinta', 'FzFilters', 'Texturas', 'OptimizedImage', 'MissingImage', 'ColorSchemeStyles', 'Pagina', 'Foto', 'DatosTaller', 'VideoPoster', 'Playlist', 'Parche', 'Relleno'];
  const faltan = inventario.filter((n) => !C.some((c) => c.nombre === n));
  assert.deepEqual(faltan, []);
  const propuestos = ['CintaCanela', 'SelloGoma', 'TituloRescate', 'CollageXerox', 'PapelRoto', 'Imperdible', 'CartelTocada', 'Tracklist'];
  assert.deepEqual(C.filter((c) => c.estado === 'propuesto').map((c) => c.nombre), propuestos);
  console.log(`  ${C.length} entradas: ${aprobados.length} aprobadas, ${propuestos.length} propuestas → ${C.map((c) => c.nombre).join(', ')}`);
});
