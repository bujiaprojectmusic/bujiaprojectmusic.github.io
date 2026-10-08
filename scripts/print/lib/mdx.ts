// MDX (mdast de remark-parse + remark-mdx) → árbol de nodos del impreso.
// Reglas (issue #9):
// - Markdown soportado: párrafo, encabezados, énfasis, negritas, código en
//   línea, listas, citas, ligas, imágenes, separador.
// - Componentes: nombre + props LITERALES. Un componente sin gemelo Typst,
//   una etiqueta HTML no soportada o una prop/expresión no literal rompen el
//   export con archivo, línea y nombre. Única excepción: expresiones que
//   leen datos del taller importados de src/data/taller.ts (`{whatsapp.url}`).
// - Ligas internas al volumen → { tipo: "ref", pagina }; externas → sólo texto.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import type { Nodo } from './tipos.ts';

/** Componentes web con gemelo en print/lib/componentes/. */
export const GEMELOS = new Set([
  'Pliego', 'Portada', 'Indice', 'SectionTitle', 'Columnas', 'Polaroid', 'Contraportada',
  'PostCover', 'ImageFull', 'ImageSide', 'Gallery', 'Xerox', 'PhotoOld', 'Quote', 'Note', 'Divider',
  'VideoPoster', 'VideoOldTV', 'VideoCinema', 'BeforeAfter', 'OptimizedImage', 'DatosTaller',
]);
/** Etiquetas HTML con gemelo (contenedores genéricos). */
export const HTML_OK = new Set(['p', 'div', 'span', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'br', 'hr', 'small', 'figure', 'figcaption', 'blockquote']);

export class ErrorExport extends Error {}

export interface Contexto {
  archivo: string;
  lineaBase: number;
  /** nombre local → nombre del componente (basename del import). */
  componentes: Map<string, string>;
  /** identificadores importados de src/data/taller.ts → valor. */
  datos: Map<string, unknown>;
  /** Resuelve una liga: devuelve la página si es interna al volumen. */
  paginaDeLiga: (url: string) => number | null;
  avisos: string[];
}

export interface PliegoCrudo {
  n: number;
  tipo: string;
  esquema: string | null;
  props: Record<string, unknown>;
  hijos: Nodo[];
  linea: number;
}

export function parsearMdx(cuerpo: string) {
  return unified().use(remarkParse).use(remarkMdx).parse(cuerpo) as any;
}

const esComentario = (v: string) => /^\s*\/\*[\s\S]*\*\/\s*$/.test(v) || v.trim() === '';

function donde(ctx: Contexto, nodo: any): string {
  const linea = (nodo?.position?.start?.line ?? 0) + ctx.lineaBase;
  return `${ctx.archivo}:${linea}`;
}

/** Evalúa un estree de expresión: literales (número, cadena, bool, null,
 *  arreglo, objeto, -n, plantilla sin ${}) o datos del taller (a, a.b). */
export function evaluar(ctx: Contexto, estree: any, nodo: any, que: string): unknown {
  const ev = (e: any): unknown => {
    switch (e.type) {
      case 'Literal': return e.value;
      case 'TemplateLiteral':
        if (e.expressions.length) break;
        return e.quasis.map((q: any) => q.value.cooked).join('');
      case 'ArrayExpression': return e.elements.map((x: any) => ev(x));
      case 'ObjectExpression': {
        const o: Record<string, unknown> = {};
        for (const p of e.properties) {
          if (p.type !== 'Property' || p.computed) break;
          const k = p.key.type === 'Identifier' ? p.key.name : p.key.value;
          o[k] = ev(p.value);
        }
        return o;
      }
      case 'UnaryExpression':
        if (e.operator === '-' && e.argument.type === 'Literal') return -e.argument.value;
        break;
      case 'JSXEmptyExpression': return undefined;
      case 'Identifier':
        if (ctx.datos.has(e.name)) return ctx.datos.get(e.name);
        throw new ErrorExport(`${donde(ctx, nodo)}: ${que} usa \`${e.name}\`, que no es un literal ni un dato importado de src/data/taller.ts.`);
      case 'MemberExpression': {
        if (e.computed) break;
        const obj: any = ev(e.object);
        if (obj == null || typeof obj !== 'object') break;
        return obj[e.property.name];
      }
    }
    throw new ErrorExport(`${donde(ctx, nodo)}: ${que} tiene una expresión JS no literal (${e.type}). En el impreso sólo entran literales (números, cadenas, arreglos, objetos) y datos de src/data/taller.ts.`);
  };
  const programa = estree?.type === 'Program' ? estree.body[0]?.expression : estree;
  if (!programa) return undefined;
  return ev(programa);
}

/** Imports del MDX: componentes (por basename) y datos del taller. */
export function leerImports(tree: any): { componentes: Map<string, string>; taller: string[] } {
  const componentes = new Map<string, string>();
  const taller: string[] = [];
  for (const n of tree.children) {
    if (n.type !== 'mdxjsEsm') continue;
    for (const d of n.data?.estree?.body ?? []) {
      if (d.type !== 'ImportDeclaration') continue;
      const src: string = d.source.value;
      if (/data\/taller(\.ts)?$/.test(src)) {
        for (const s of d.specifiers) taller.push(s.local.name);
      } else {
        const base = src.split('/').pop()!.replace(/\.astro$/, '');
        for (const s of d.specifiers) componentes.set(s.local.name, base);
      }
    }
  }
  return { componentes, taller };
}

function props(ctx: Contexto, el: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of el.attributes ?? []) {
    if (a.type !== 'mdxJsxAttribute') {
      throw new ErrorExport(`${donde(ctx, el)}: <${el.name}> usa {...spread}; en el impreso las props tienen que ser literales.`);
    }
    if (a.value == null) out[a.name] = true;
    else if (typeof a.value === 'string') out[a.name] = a.value;
    else out[a.name] = evaluar(ctx, a.value.data?.estree, el, `la prop \`${a.name}\` de <${el.name}>`);
  }
  return out;
}

const texto = (v: string): Nodo => ({ t: 'texto', v: v.replace(/\s*\n\s*/g, ' ') });

export function convertirHijos(ctx: Contexto, hijos: any[]): Nodo[] {
  const out: Nodo[] = [];
  for (const h of hijos ?? []) {
    const r = convertir(ctx, h);
    if (r) out.push(...r);
  }
  return out;
}

export function convertir(ctx: Contexto, n: any): Nodo[] | null {
  switch (n.type) {
    case 'text': return [texto(n.value)];
    case 'paragraph': {
      // Un componente solo dentro de un párrafo (<SectionTitle> en su
      // propia línea) es un bloque, no un párrafo.
      const reales = n.children.filter((c: any) => !(c.type === 'text' && c.value.trim() === ''));
      if (reales.length === 1 && reales[0].type === 'mdxJsxTextElement') return convertir(ctx, reales[0]);
      const hijos = convertirHijos(ctx, n.children);
      return hijos.length ? [{ t: 'parrafo', hijos }] : [];
    }
    case 'strong': return [{ t: 'fuerte', hijos: convertirHijos(ctx, n.children) }];
    case 'emphasis': return [{ t: 'enfasis', hijos: convertirHijos(ctx, n.children) }];
    case 'inlineCode': return [{ t: 'codigo', v: n.value }];
    case 'break': return [{ t: 'salto' }];
    case 'heading': return [{ t: 'titulo', nivel: n.depth, hijos: convertirHijos(ctx, n.children) }];
    case 'list':
      return [{ t: 'lista', ordenada: !!n.ordered, inicio: n.start ?? 1, items: n.children.map((li: any) => convertirHijos(ctx, li.children)) }];
    case 'blockquote': return [{ t: 'cita', hijos: convertirHijos(ctx, n.children) }];
    case 'thematicBreak': return [{ t: 'separador' }];
    case 'code': return [{ t: 'bloque_codigo', v: n.value }];
    case 'html':
      throw new ErrorExport(`${donde(ctx, n)}: HTML crudo no soportado en el impreso.`);
    case 'link': {
      const pagina = ctx.paginaDeLiga(n.url);
      return [{ t: 'liga', destino: pagina != null ? { tipo: 'ref', pagina } : { tipo: 'externa' }, hijos: convertirHijos(ctx, n.children) }];
    }
    case 'image':
      return [{ t: 'componente', nombre: 'ImageFull', props: { src: n.url, alt: n.alt ?? '', caption: n.title ?? undefined }, hijos: [] }];
    case 'mdxFlowExpression':
    case 'mdxTextExpression': {
      if (esComentario(n.value)) return [];
      const v = evaluar(ctx, n.data?.estree, n, 'una expresión {…}');
      if (v == null) return [];
      if (typeof v === 'string' || typeof v === 'number') return [texto(String(v))];
      throw new ErrorExport(`${donde(ctx, n)}: la expresión {${n.value.trim()}} no da texto; en el impreso sólo entran expresiones con datos de src/data/taller.ts.`);
    }
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement': {
      if (n.name == null) return convertirHijos(ctx, n.children); // <>…</>
      if (/^[a-z]/.test(n.name)) {
        if (!HTML_OK.has(n.name)) throw new ErrorExport(`${donde(ctx, n)}: la etiqueta <${n.name}> no tiene gemelo en el impreso.`);
        const p = props(ctx, n);
        if (n.name === 'a') {
          const url = String(p.href ?? '');
          const pagina = ctx.paginaDeLiga(url);
          return [{ t: 'liga', destino: pagina != null ? { tipo: 'ref', pagina } : { tipo: 'externa' }, hijos: convertirHijos(ctx, n.children) }];
        }
        if (n.name === 'br') return [{ t: 'salto' }];
        if (n.name === 'hr') return [{ t: 'separador' }];
        return [{ t: 'html', etiqueta: n.name, clase: String(p.class ?? ''), hijos: convertirHijos(ctx, n.children) }];
      }
      const nombre = ctx.componentes.get(n.name);
      if (!nombre) throw new ErrorExport(`${donde(ctx, n)}: <${n.name}> no está importado en el MDX.`);
      if (!GEMELOS.has(nombre)) throw new ErrorExport(`${donde(ctx, n)}: el componente <${n.name}> (${nombre}.astro) no tiene gemelo Typst en print/lib/componentes/. Agregalo ahí o sacalo del volumen.`);
      return [{ t: 'componente', nombre, props: props(ctx, n), hijos: convertirHijos(ctx, n.children) }];
    }
    case 'mdxjsEsm': return [];
    case 'yaml': return [];
    default:
      throw new ErrorExport(`${donde(ctx, n)}: nodo Markdown "${n.type}" no soportado en el impreso.`);
  }
}

/** Los <Pliego> de la raíz del MDX. Cualquier otra cosa fuera de un pliego es error. */
export function pliegos(ctx: Contexto, tree: any): PliegoCrudo[] {
  const out: PliegoCrudo[] = [];
  for (const n of tree.children) {
    if (n.type === 'mdxjsEsm' || n.type === 'yaml') continue;
    if ((n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression') && esComentario(n.value)) continue;
    if (n.type === 'paragraph' && n.children.every((c: any) => c.type === 'text' && c.value.trim() === '')) continue;
    if (n.type !== 'mdxJsxFlowElement' || ctx.componentes.get(n.name) !== 'Pliego') {
      throw new ErrorExport(`${donde(ctx, n)}: hay contenido fuera de un <Pliego> (${n.type}${n.name ? ' ' + n.name : ''}). En un volumen todo va adentro de <Pliego n={…}>.`);
    }
    const p = props(ctx, n);
    const num = Number(p.n);
    if (!Number.isInteger(num) || num < 1) throw new ErrorExport(`${donde(ctx, n)}: <Pliego> sin n entero.`);
    out.push({ n: num, tipo: String(p.tipo ?? 'normal'), esquema: p.scheme ? String(p.scheme) : null, props: p, hijos: convertirHijos(ctx, n.children), linea: (n.position?.start?.line ?? 0) + ctx.lineaBase });
  }
  return out;
}
