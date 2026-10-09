// Adaptador "piezas" (issue #13): lee los volúmenes compuestos de
// src/content/volumenes/vol-NN.yml con sus piezas de src/content/piezas/**
// y entrega los pliegos ya numerados (portada, índice generado, páginas
// de cada pieza, rellenos, Fin, contraportada) para el export del impreso.
// Reutiliza los esquemas zod de src/content/schemas.ts y la composición de
// src/utils/componer.ts; `consentimiento_ref` y `redes` NO salen al JSON.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { piezaSchema, volumenSchema } from '../../../src/content/schemas.ts';
import { componer, slugVolumen, type EntradaVolumen } from '../../../src/utils/componer.ts';
import { parsearMdx, leerImports, convertirHijos, props as leerProps, ErrorExport, type Contexto } from '../lib/mdx.ts';
import type { Nodo } from '../lib/tipos.ts';

export interface VolumenCompuestoFuente {
  slug: string;
  archivo: string;
  frontmatter: Record<string, any>;
  /** Pliegos ya numerados 1…N con sus nodos (los <Pagina> de cada pieza). */
  pliegos: { n: number; tipo: string; esquema: string | null; props: Record<string, unknown>; hijos: Nodo[]; linea: number; archivo: string; relleno?: string }[];
  avisos: string[];
  paginas: number;
  /** Para el índice: título, autor y página. */
  indice: { pagina: number; titulo: string; autor: string }[];
  creditos: string[];
}

// Sin astro:content: image() se simula con la ruta ya transformada (string) y
// reference() con el id de la pieza.
const imageFalso = () => z.string();
const referenceFalso = () => z.string();
const esquemaPieza = piezaSchema(imageFalso);
const esquemaVolumen = volumenSchema(imageFalso, referenceFalso as any);

function listarYml(raiz: string): string[] {
  const dir = path.join(raiz, 'src', 'content', 'volumenes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^[^_].*\.ya?ml$/.test(f)).map((f) => path.join(dir, f));
}

function leerPieza(raiz: string, id: string) {
  const archivo = path.join(raiz, 'src', 'content', 'piezas', id, 'index.mdx');
  if (!fs.existsSync(archivo)) throw new ErrorExport(`la pieza "${id}" no existe (${path.relative(raiz, archivo)}).`);
  const src = fs.readFileSync(archivo, 'utf8');
  const { data, content, matter: fm } = matter(src);
  const r = esquemaPieza.safeParse(data);
  if (!r.success) throw new ErrorExport(`${path.relative(raiz, archivo)}: frontmatter inválido:\n  - ${r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n  - ')}`);
  return { id, archivo: path.relative(raiz, archivo), data: r.data, cuerpo: content, lineaBase: fm ? fm.split('\n').length + 1 : 0 };
}

export function listarVolumenesCompuestos(raiz: string, datosTaller: Map<string, unknown>): VolumenCompuestoFuente[] {
  const out: VolumenCompuestoFuente[] = [];
  const usoGlobal = new Map<string, string>();
  for (const f of listarYml(raiz)) {
    const crudo = yaml.load(fs.readFileSync(f, 'utf8')) as any;
    const r = esquemaVolumen.safeParse(crudo);
    if (!r.success) throw new ErrorExport(`${path.relative(raiz, f)}: yml inválido:\n  - ${r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n  - ')}`);
    const v = r.data;
    if (v.draft) continue;
    const slug = slugVolumen(v.numero);
    const piezas = new Map<string, ReturnType<typeof leerPieza>>();
    const entradas: EntradaVolumen[] = [];
    for (const e of v.piezas as any[]) {
      if (e.pieza) {
        const p = leerPieza(raiz, String(e.pieza));
        piezas.set(p.id, p);
        entradas.push({ pieza: { id: p.id, titulo: p.data.titulo, autor: p.data.autor, paginas: p.data.paginas, draft: p.data.draft }, desde: e.desde });
      } else entradas.push({ relleno: e.relleno, desde: e.desde });
    }
    const comp = componer(slug, entradas, usoGlobal, v.paginas_minimo);
    const avisos = [...comp.avisos];
    const pliegos: VolumenCompuestoFuente['pliegos'] = [];
    const subtitulo = v.portada.subtitulo ?? `${new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(v.fecha)} — Texcoco`;
    pliegos.push({ n: 1, tipo: 'portada', esquema: null, props: {}, linea: 0, archivo: path.relative(raiz, f), hijos: [
      { t: 'componente', nombre: 'Portada', props: { volume: v.numero, title: v.titulo, subtitle: subtitulo, ...(v.portada.imagen ? { image: v.portada.imagen } : {}) }, hijos: [] },
      ...(v.portada.credito ? [{ t: 'html', etiqueta: 'p', clase: 'fz-small', hijos: [{ t: 'texto', v: `Foto de portada: ${v.portada.credito}` }] } as Nodo] : []),
    ] });
    pliegos.push({ n: 2, tipo: 'indice', esquema: null, props: {}, linea: 0, archivo: path.relative(raiz, f), hijos: [
      { t: 'componente', nombre: 'Indice', props: { items: comp.indice.map((i) => ({ page: String(i.pagina).padStart(2, '0'), title: `${i.titulo} — ${i.autor}` })) }, hijos: [] },
    ] });
    // Páginas de cada pieza: <Pagina n> → pliego desde + n − 1.
    const paginasPorPieza = new Map<string, Map<number, { hijos: Nodo[]; esquema: string | null; props: Record<string, unknown>; linea: number }>>();
    for (const p of piezas.values()) {
      const tree = parsearMdx(p.cuerpo);
      const { componentes, taller: idsTaller } = leerImports(tree);
      const datos = new Map<string, unknown>();
      for (const id of idsTaller) datos.set(id, datosTaller.get(id));
      const ctx: Contexto = { archivo: p.archivo, lineaBase: p.lineaBase, componentes, datos, paginaDeLiga: () => null, avisos };
      const mapa = new Map<number, { hijos: Nodo[]; esquema: string | null; props: Record<string, unknown>; linea: number }>();
      for (const n of tree.children) {
        if (n.type === 'mdxjsEsm' || n.type === 'yaml') continue;
        if ((n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression') && /^\s*\/\*[\s\S]*\*\/\s*$/.test(n.value)) continue;
        if (n.type === 'paragraph' && n.children.every((c: any) => c.type === 'text' && c.value.trim() === '')) continue;
        if (n.type !== 'mdxJsxFlowElement' || componentes.get(n.name) !== 'Pagina') {
          throw new ErrorExport(`${p.archivo}:${(n.position?.start?.line ?? 0) + p.lineaBase}: en una pieza todo va adentro de <Pagina n={…}> (encontré ${n.type}${n.name ? ' ' + n.name : ''}).`);
        }
        const pr = leerProps(ctx, n);
        const rel = Number(pr.n);
        if (!Number.isInteger(rel) || rel < 1 || rel > p.data.paginas) throw new ErrorExport(`${p.archivo}: <Pagina n={${pr.n}}> fuera de 1…${p.data.paginas} (paginas: ${p.data.paginas}).`);
        if (mapa.has(rel)) throw new ErrorExport(`${p.archivo}: <Pagina n={${rel}}> repetida.`);
        // <Foto n> → componente de imagen con los datos del frontmatter (pie + crédito).
        const hijos = reemplazarFotos(convertirHijos(ctx, n.children), p);
        mapa.set(rel, { hijos, esquema: pr.scheme ? String(pr.scheme) : p.data.scheme ?? null, props: pr, linea: (n.position?.start?.line ?? 0) + p.lineaBase });
      }
      if (mapa.size !== p.data.paginas) throw new ErrorExport(`${p.archivo}: tiene ${mapa.size} <Pagina> y el frontmatter dice paginas: ${p.data.paginas}.`);
      paginasPorPieza.set(p.id, mapa);
    }
    for (const pg of comp.paginas) {
      if (pg.tipo === 'pieza') {
        const p = piezas.get(pg.pieza.id)!;
        const pagina = paginasPorPieza.get(p.id)!.get(pg.rel)!;
        const hijos = [...pagina.hijos];
        if (pg.rel === p.data.paginas) {
          hijos.push({ t: 'html', etiqueta: 'p', clase: 'fz-credito', hijos: [{ t: 'texto', v: p.data.credito + (p.data.bio ? ` · ${p.data.bio}` : '') }] });
        }
        pliegos.push({ n: pg.n, tipo: 'normal', esquema: pagina.esquema ?? v.colorScheme, props: pagina.props, hijos, linea: pagina.linea, archivo: p.archivo });
      } else if (pg.tipo === 'relleno') {
        pliegos.push({ n: pg.n, tipo: 'relleno', esquema: null, props: {}, hijos: [], linea: 0, archivo: path.relative(raiz, f), relleno: pg.relleno });
      } else if (pg.tipo === 'fin') {
        pliegos.push({ n: pg.n, tipo: 'fin', esquema: null, props: {}, hijos: [], linea: 0, archivo: path.relative(raiz, f) });
      } else if (pg.tipo === 'contraportada') {
        pliegos.push({ n: pg.n, tipo: 'contraportada', esquema: null, props: {}, linea: 0, archivo: path.relative(raiz, f), hijos: [
          { t: 'componente', nombre: 'Contraportada', props: { texto: v.contraportada.texto }, hijos: [] },
          { t: 'componente', nombre: 'DatosTaller', props: {}, hijos: [] },
        ] });
      }
    }
    out.push({
      slug, archivo: path.relative(raiz, f), paginas: comp.N, avisos, pliegos,
      indice: comp.indice.map((i) => ({ pagina: i.pagina, titulo: i.titulo, autor: i.autor })),
      creditos: [...piezas.values()].map((p) => `${p.data.titulo}: ${p.data.credito}`),
      // Frontmatter "como el de un post" para exportar(): sin consentimiento_ref ni redes.
      frontmatter: { title: v.titulo, volume: v.numero, date: v.fecha, author: [...new Set([...piezas.values()].map((p) => p.data.autor))].join(', ') || 'Ripper', description: v.descripcion, colorScheme: v.colorScheme, prueba: v.prueba, impreso: v.impreso, fotos_creditos: [...piezas.values()].flatMap((p) => p.data.fotos.map((x: any) => x.credito)) },
    });
  }
  return out.sort((a, b) => a.frontmatter.volume - b.frontmatter.volume);
}

/** <Foto n={k} estilo="…" /> → ImageFull/ImageSide/Polaroid/PhotoOld/Xerox con src, alt y pie + crédito del frontmatter. */
function reemplazarFotos(nodos: Nodo[], p: ReturnType<typeof leerPieza>): Nodo[] {
  return nodos.map((n) => {
    if (n.t === 'componente' && n.nombre === 'Foto') {
      const k = Number(n.props.n);
      const f = p.data.fotos[k - 1];
      if (!f) throw new ErrorExport(`${p.archivo}: <Foto n={${n.props.n}}> no existe: el frontmatter tiene ${p.data.fotos.length} foto(s).`);
      const pie = `${f.pie}${f.pie && !/[.!?]$/.test(f.pie.trim()) ? '.' : ''} Foto: ${f.credito}`.trim();
      const estilo = String(n.props.estilo ?? 'full');
      const nombre = estilo === 'side' ? 'ImageSide' : estilo === 'polaroid' ? 'Polaroid' : estilo === 'vieja' ? 'PhotoOld' : estilo === 'xerox' ? 'Xerox' : 'ImageFull';
      const props: Record<string, unknown> = { src: f.src, alt: f.alt, caption: pie };
      if (nombre === 'ImageSide') { props.side = n.props.side ?? 'right'; props.width = n.props.width ?? '42%'; }
      if (n.props.tilt != null) props.tilt = n.props.tilt;
      return { t: 'componente', nombre, props, hijos: [] };
    }
    if ('hijos' in n) return { ...n, hijos: reemplazarFotos(n.hijos, p) } as Nodo;
    if (n.t === 'lista') return { ...n, items: n.items.map((it) => reemplazarFotos(it, p)) };
    return n;
  });
}
