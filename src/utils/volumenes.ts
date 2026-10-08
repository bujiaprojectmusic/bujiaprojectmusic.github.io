// Lista unificada de volúmenes del fanzine (issue #13): los compuestos
// desde src/content/volumenes/*.yml (modelo nuevo) y los MDX de
// src/content/posts con fanzine: true que no sean legado (vol-00 de
// prueba). La usan /fanzine, /volumenes y /fanzine/[slug].
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { componer, slugVolumen, type Composicion, type EntradaVolumen } from './componer';
import { fanzineSlug } from './fanzine';

export interface VolumenListado {
  slug: string;
  numero: number;
  titulo: string;
  fecha: Date;
  descripcion?: string;
  prueba: boolean;
  cover?: ImageMetadata;
  origen: 'yml' | 'mdx';
}

export async function listarVolumenes(): Promise<VolumenListado[]> {
  const out: VolumenListado[] = [];
  const posts = await getCollection('posts', ({ data }) => data.fanzine && !data.draft && !data.legado);
  for (const p of posts) {
    out.push({ slug: fanzineSlug(p), numero: p.data.volume!, titulo: p.data.title, fecha: p.data.date, descripcion: p.data.description, prueba: p.data.prueba, cover: p.data.cover, origen: 'mdx' });
  }
  const ymls = await getCollection('volumenes', ({ data }) => !data.draft);
  for (const v of ymls) {
    out.push({ slug: slugVolumen(v.data.numero), numero: v.data.numero, titulo: v.data.titulo, fecha: v.data.fecha, descripcion: v.data.descripcion, prueba: v.data.prueba, cover: v.data.portada.imagen, origen: 'yml' });
  }
  const vistos = new Map<string, string>();
  for (const v of out) {
    if (vistos.has(v.slug)) throw new Error(`Dos volúmenes con el mismo número (${v.slug}): ${vistos.get(v.slug)} y ${v.origen}. Marcá el MDX viejo con legado: true.`);
    vistos.set(v.slug, v.origen);
  }
  return out.sort((a, b) => b.numero - a.numero);
}

export interface VolumenCompuesto {
  entry: CollectionEntry<'volumenes'>;
  slug: string;
  composicion: Composicion;
  piezas: Map<string, CollectionEntry<'piezas'>>;
}

/** Compone un volumen yml: resuelve las referencias a piezas y valida el mapa de páginas. */
export async function componerVolumen(entry: CollectionEntry<'volumenes'>, usoGlobal?: Map<string, string>): Promise<VolumenCompuesto> {
  const slug = slugVolumen(entry.data.numero);
  const piezas = new Map<string, CollectionEntry<'piezas'>>();
  const entradas: EntradaVolumen[] = [];
  for (const e of entry.data.piezas) {
    if ('pieza' in e) {
      const p = await getEntry(e.pieza);
      if (!p) throw new Error(`${slug}: la pieza "${e.pieza.id}" no existe en src/content/piezas/.`);
      piezas.set(p.id, p);
      entradas.push({ pieza: { id: p.id, titulo: p.data.titulo, autor: p.data.autor, paginas: p.data.paginas, draft: p.data.draft }, desde: e.desde });
    } else {
      entradas.push({ relleno: e.relleno, desde: e.desde });
    }
  }
  const composicion = componer(slug, entradas, usoGlobal, entry.data.paginas_minimo);
  for (const a of composicion.avisos) console.warn(`[volumenes] ${a}`);
  return { entry, slug, composicion, piezas };
}
