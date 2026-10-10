// Consistencia índice ↔ pliegos y lista de volúmenes (issue #14, alcance 2).
import fs from 'node:fs';
import path from 'node:path';
import { leer, decodificar, textoVisible, etiquetas } from './html.mjs';
import { leerPiezas, leerVolumenes, volumenesPublicados } from './contenido.mjs';

/** Entradas del índice en el HTML: [{ pagina, href, titulo, linea }]. */
export function entradasIndice(html) {
  const out = [];
  const re = /<a\s+href="#pagina-(\d+)"[^>]*class="fz-indice__link"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const interior = m[2];
    const pag = interior.match(/class="fz-indice__page"[^>]*>([^<]*)</);
    const tit = interior.match(/class="fz-indice__item-title"[^>]*>([^<]*)</);
    out.push({ ancla: Number(m[1]), pagina: pag ? decodificar(pag[1]).trim() : '', titulo: tit ? decodificar(tit[1]).trim() : '', linea: html.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** Pliegos del HTML: Map n → { tipo } */
export function pliegos(html) {
  const out = new Map();
  for (const t of etiquetas(html, 'section')) {
    const m = (t.attrs.id ?? '').match(/^pagina-(\d+)$/);
    if (m) out.set(Number(m[1]), { tipo: t.attrs['data-tipo'] ?? '', linea: t.linea });
  }
  return out;
}

export function revisarIndice({ dist, contenido = 'src/content' }) {
  const errores = [];
  const avisos = [];
  const detalles = [];
  const piezas = leerPiezas(contenido);
  const vols = leerVolumenes(contenido);
  for (const v of vols) {
    const archivo = path.join(dist, 'fanzine', v.slug, 'index.html');
    const rel = path.relative(process.cwd(), archivo);
    if (!fs.existsSync(archivo)) {
      errores.push({ archivo: rel, mensaje: `no existe la página del volumen ${v.slug} (${v.archivo})` });
      continue;
    }
    const html = leer(archivo);
    const entradas = entradasIndice(html);
    const secciones = pliegos(html);
    if (!entradas.length) errores.push({ archivo: rel, mensaje: `el volumen ${v.slug} no tiene índice (ningún <a href="#pagina-N" class="fz-indice__link">)` });
    for (const e of entradas) {
      const sel = `.fz-indice__link[href="#pagina-${e.ancla}"]`;
      if (!secciones.has(e.ancla)) errores.push({ archivo: rel, linea: e.linea, selector: sel, mensaje: `el índice apunta a #pagina-${e.ancla} pero ese pliego no existe` });
      else if (secciones.get(e.ancla).tipo === 'relleno') errores.push({ archivo: rel, linea: e.linea, selector: sel, mensaje: `el índice apunta a #pagina-${e.ancla}, que es una página de relleno` });
      if (Number(e.pagina) !== e.ancla) errores.push({ archivo: rel, linea: e.linea, selector: sel, mensaje: `el número impreso en el índice ("${e.pagina}") no coincide con su posición (#pagina-${e.ancla})` });
    }
    if (v.origen === 'yml') {
      for (const p of v.piezas) {
        const pieza = piezas.get(p.pieza);
        if (!pieza) {
          errores.push({ archivo: v.archivo, mensaje: `la pieza "${p.pieza}" del yml no existe en ${contenido}/piezas/` });
          continue;
        }
        const esperado = `${pieza.data.titulo} — ${pieza.data.autor}`;
        const en = entradas.find((e) => e.ancla === p.desde);
        if (!en) errores.push({ archivo: rel, mensaje: `la pieza "${p.pieza}" (desde: ${p.desde}, ${v.archivo}) no aparece en el índice del volumen ${v.slug}` });
        else if (en.titulo !== esperado) errores.push({ archivo: rel, linea: en.linea, selector: `.fz-indice__link[href="#pagina-${p.desde}"]`, mensaje: `título del índice en la pág. ${p.desde}: "${en.titulo}" ≠ "${esperado}" (pieza ${p.pieza})` });
      }
      detalles.push(`${v.slug}: ${v.piezas.length} piezas en el yml, ${entradas.length} entradas en el índice, ${secciones.size} pliegos`);
    } else {
      detalles.push(`${v.slug} (MDX): ${entradas.length} entradas en el índice, ${secciones.size} pliegos (títulos escritos a mano: sólo se revisan anclas y números)`);
    }
  }
  // Lista de volúmenes en /volumenes y /fanzine.
  for (const pagina of ['volumenes', 'fanzine']) {
    const archivo = path.join(dist, pagina, 'index.html');
    const rel = path.relative(process.cwd(), archivo);
    if (!fs.existsSync(archivo)) {
      errores.push({ archivo: rel, mensaje: `no existe /${pagina}` });
      continue;
    }
    const html = leer(archivo);
    for (const v of volumenesPublicados(contenido)) {
      const re = new RegExp(`href="(?:https?://[^"/]+)?/fanzine/${v.slug}"`);
      if (!re.test(html)) errores.push({ archivo: rel, mensaje: `el volumen ${v.slug} ("${v.titulo}") no aparece enlazado en /${pagina}` });
      else if (!textoVisible(html).includes(v.titulo)) avisos.push({ archivo: rel, mensaje: `/${pagina} enlaza ${v.slug} pero no muestra su título "${v.titulo}"` });
    }
  }
  return { nombre: 'Índice ↔ pliegos y lista de volúmenes', estado: errores.length ? 'error' : avisos.length ? 'aviso' : 'ok', resumen: detalles.join(' · ') || 'sin volúmenes', errores, avisos, detalles };
}
