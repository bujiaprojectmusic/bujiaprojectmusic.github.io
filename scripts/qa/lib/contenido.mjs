// Lee el contenido fuente del fanzine (issue #14): volúmenes yml, piezas y
// posts MDX con fanzine: true. JS plano (sin astro:content) para correr
// fuera de Astro. Replica las reglas de src/utils/volumenes.ts:
//  - yml: no draft; prueba o sin_listar → no sale en /fanzine ni /volumenes.
//  - MDX fanzine: true, no draft, no legado.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import matter from 'gray-matter';

export function slugVolumen(numero) {
  return `vol-${String(numero).padStart(2, '0')}`;
}

function listar(dir, filtro) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (filtro(e.name)) out.push(p);
    }
  };
  rec(dir);
  return out.sort();
}

/** Piezas: { id, archivo, data, cuerpo }; id = carpeta (src/content/piezas/<id>/index.mdx). */
export function leerPiezas(raiz = 'src/content') {
  const dir = path.join(raiz, 'piezas');
  const out = new Map();
  for (const f of listar(dir, (n) => /\.mdx?$/.test(n))) {
    const rel = path.relative(dir, f).replace(/\\/g, '/');
    if (path.basename(rel).startsWith('_') || rel.startsWith('_')) continue;
    const id = rel.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '');
    const m = matter(fs.readFileSync(f, 'utf8'));
    out.set(id, { id, archivo: f, data: m.data, cuerpo: m.content });
  }
  return out;
}

/** Volúmenes yml: { slug, numero, archivo, data, piezas: [{pieza, desde}], prueba, draft }. */
export function leerVolumenesYml(raiz = 'src/content') {
  const dir = path.join(raiz, 'volumenes');
  const out = [];
  for (const f of listar(dir, (n) => /\.ya?ml$/.test(n))) {
    if (path.basename(f).startsWith('_')) continue;
    const data = yaml.load(fs.readFileSync(f, 'utf8')) ?? {};
    out.push({
      origen: 'yml',
      slug: slugVolumen(data.numero),
      numero: data.numero,
      titulo: data.titulo,
      archivo: f,
      data,
      prueba: !!data.prueba,
      sinListar: !!data.sin_listar,
      draft: !!data.draft,
      piezas: (data.piezas ?? []).filter((p) => p && p.pieza).map((p) => ({ pieza: String(p.pieza), desde: Number(p.desde) })),
    });
  }
  return out;
}

/** Posts MDX con fanzine: true (no draft, no legado). */
export function leerVolumenesMdx(raiz = 'src/content') {
  const dir = path.join(raiz, 'posts');
  const out = [];
  for (const f of listar(dir, (n) => /\.mdx?$/.test(n))) {
    const m = matter(fs.readFileSync(f, 'utf8'));
    const d = m.data;
    if (!d.fanzine || d.draft || d.legado) continue;
    out.push({ origen: 'mdx', slug: slugVolumen(d.volume), numero: d.volume, titulo: d.title, archivo: f, data: d, prueba: !!d.prueba, sinListar: false, draft: false, piezas: [] });
  }
  return out;
}

/** Todos los volúmenes que generan /fanzine/vol-NN (sin draft). */
export function leerVolumenes(raiz = 'src/content') {
  return [...leerVolumenesYml(raiz).filter((v) => !v.draft), ...leerVolumenesMdx(raiz)].sort((a, b) => a.numero - b.numero);
}

/** Los que salen en /fanzine y /volumenes: sin prueba ni sin_listar. */
export function volumenesPublicados(raiz = 'src/content') {
  return leerVolumenes(raiz).filter((v) => !v.prueba && !v.sinListar);
}
