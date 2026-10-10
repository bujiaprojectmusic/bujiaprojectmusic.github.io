// Metadatos y créditos en el HTML final (issue #14, alcance 3):
//  - cada pieza de un volumen publicado muestra su crédito (.fz-credito);
//  - cada <img> de /fanzine/** tiene alt no vacío, o alt="" sólo si el
//    componente la marcó decorativa (aria-hidden="true" / role="presentation");
//  - cada foto de una pieza (fotos[] del frontmatter) que se pinta lleva
//    "Foto: <crédito>" visible; la portada con imagen lleva crédito;
//  - cada pieza tiene licencia y consentimiento_ref.
import fs from 'node:fs';
import path from 'node:path';
import { listarHtml, leer, etiquetas, textoVisible, esRedireccion } from './html.mjs';
import { leerPiezas, leerVolumenes } from './contenido.mjs';

export function revisarCreditos({ dist, contenido = 'src/content' }) {
  const errores = [];
  const avisos = [];
  const detalles = [];
  // 1) alt en todas las <img> de /fanzine/**
  let imgs = 0;
  for (const archivo of listarHtml(path.join(dist, 'fanzine'))) {
    const html = leer(archivo);
    if (esRedireccion(html)) continue;
    const rel = path.relative(process.cwd(), archivo);
    for (const t of etiquetas(html, 'img')) {
      imgs++;
      const a = t.attrs;
      if (a.alt == null) errores.push({ archivo: rel, linea: t.linea, mensaje: `<img> sin atributo alt (src="${(a.src ?? '').slice(0, 60)}")` });
      else if (a.alt.trim() === '' && !(a['aria-hidden'] === 'true' || a.role === 'presentation' || a.role === 'none' || 'data-decorativa' in a))
        errores.push({ archivo: rel, linea: t.linea, mensaje: `<img alt=""> sin marcar como decorativa (aria-hidden="true" o role="presentation"); src="${(a.src ?? '').slice(0, 60)}"` });
    }
  }
  detalles.push(`${imgs} <img> en /fanzine/**`);
  // 2) créditos por volumen
  const piezas = leerPiezas(contenido);
  for (const v of leerVolumenes(contenido)) {
    const archivo = path.join(dist, 'fanzine', v.slug, 'index.html');
    if (!fs.existsSync(archivo)) continue;
    const rel = path.relative(process.cwd(), archivo);
    const html = leer(archivo);
    const texto = textoVisible(html);
    const creditosHtml = [...html.matchAll(/class="fz-credito"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textoVisible(m[1]).trim());
    const alts = new Set(etiquetas(html, 'img').map((t) => (t.attrs.alt ?? '').trim()).filter(Boolean));
    if (v.origen === 'yml') {
      const port = v.data.portada ?? {};
      if (port.imagen && !(port.credito && texto.includes(port.credito))) errores.push({ archivo: rel, mensaje: `la portada de ${v.slug} tiene imagen pero no muestra crédito (portada.credito en ${v.archivo})` });
      for (const p of v.piezas) {
        const pieza = piezas.get(p.pieza);
        if (!pieza) continue;
        const d = pieza.data;
        if (!d.licencia) errores.push({ archivo: pieza.archivo, mensaje: `la pieza ${p.pieza} no tiene licencia` });
        if (!d.consentimiento_ref) errores.push({ archivo: pieza.archivo, mensaje: `la pieza ${p.pieza} no tiene consentimiento_ref` });
        if (!d.credito) errores.push({ archivo: pieza.archivo, mensaje: `la pieza ${p.pieza} no tiene credito` });
        else if (!creditosHtml.some((c) => c.includes(d.credito))) errores.push({ archivo: rel, selector: `#pagina-${p.desde + (d.paginas ?? 1) - 1} .fz-credito`, mensaje: `la pieza ${p.pieza} no muestra su crédito "${d.credito}" en ${v.slug}` });
        for (const [i, f] of (d.fotos ?? []).entries()) {
          if (!f.alt) errores.push({ archivo: pieza.archivo, mensaje: `foto ${i + 1} de ${p.pieza} sin alt` });
          if (!f.credito) errores.push({ archivo: pieza.archivo, mensaje: `foto ${i + 1} de ${p.pieza} sin crédito` });
          if (f.alt && alts.has(f.alt) && f.credito && !texto.includes(`Foto: ${f.credito}`)) errores.push({ archivo: rel, mensaje: `la foto "${f.alt}" (${p.pieza}) se pinta sin su crédito visible "Foto: ${f.credito}"` });
        }
      }
      detalles.push(`${v.slug}: ${v.piezas.length} piezas, ${creditosHtml.length} créditos visibles`);
    } else {
      detalles.push(`${v.slug} (MDX): créditos escritos a mano en el MDX, sólo se revisan los alt`);
    }
  }
  return { nombre: 'Metadatos y créditos', estado: errores.length ? 'error' : avisos.length ? 'aviso' : 'ok', resumen: detalles.join(' · '), errores, avisos, detalles };
}
