// Chequeo de piezas con template poema, <VersoDestacado> y <VideoInstagram>.
// Lo corre el build (scripts/check-poema.ts), el export de un volumen y
// la prueba impresa del borrador. El verso se busca en el bloque ```poema,
// no en el atributo del componente.
import { parsearMdx, leerImports, props as leerProps, type Contexto } from './mdx.ts';
import { cuerpoDePoema, ErrorPoema, normalizarCuerpo, urlPublicaInstagram } from '../../../src/utils/poema.ts';

export interface VideoInstagramDato {
  url: string;
  credito: string;
  leyenda: string;
}

export interface BloquePoema {
  tipo: 'verso' | 'video' | 'cuerpo';
  verso?: string;
  url?: string;
  credito?: string;
  leyenda?: string;
  texto?: string;
}

function contexto(archivo: string, tree: any): Contexto {
  const { componentes } = leerImports(tree);
  return { archivo, lineaBase: 0, componentes, datos: new Map(), paginaDeLiga: () => null, avisos: [] };
}

/** El atributo verso="…" no cuenta como cuerpo. */
function sinVersoDestacado(md: string): string {
  return md.replace(/<VersoDestacado\b[\s\S]*?\/>/g, '').replace(/<VersoDestacado\b[\s\S]*?>[\s\S]*?<\/VersoDestacado>/g, '');
}

export function bloquesDe(cuerpo: string, archivo: string): BloquePoema[] {
  const tree = parsearMdx(cuerpo);
  const ctx = contexto(archivo, tree);
  const out: BloquePoema[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === 'code' && n.lang === 'poema') {
      out.push({ tipo: 'cuerpo', texto: normalizarCuerpo(n.value) });
      return;
    }
    if (n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') {
      const nombre = n.name ? (ctx.componentes.get(n.name) ?? n.name) : null;
      if (nombre === 'VersoDestacado') {
        const p = leerProps(ctx, n);
        out.push({ tipo: 'verso', verso: typeof p.verso === 'string' ? p.verso : '' });
        return;
      }
      if (nombre === 'VideoInstagram') {
        const p = leerProps(ctx, n);
        out.push({
          tipo: 'video',
          url: typeof p.url === 'string' ? p.url : '',
          credito: typeof p.credito === 'string' ? p.credito : '',
          leyenda: typeof p.leyenda === 'string' ? p.leyenda : '',
        });
        return;
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of tree.children ?? []) walk(n);
  return out;
}

/** Falla si un verso no está tal cual en el cuerpo o si un video tiene url vacía. */
export function validarContenido(cuerpo: string, data: { template?: string }, archivo: string): BloquePoema[] {
  const bloques = bloquesDe(cuerpo, archivo);
  const poema = data.template === 'poema';
  const texto = cuerpoDePoema(cuerpo);
  if (poema && !texto.trim()) {
    throw new ErrorPoema(`${archivo}: template "poema" necesita un bloque \`\`\`poema con el cuerpo (verso por verso, con los espacios del original).`);
  }
  for (const b of bloques) {
    if (b.tipo === 'verso') {
      if (!b.verso) throw new ErrorPoema(`${archivo}: <VersoDestacado> necesita verso="…" (no vacío).`);
      // En un poema el cuerpo es sólo el bloque ```poema. En otra pieza, el
      // markdown sin el propio componente (el atributo no alcanza).
      const donde = poema ? texto : sinVersoDestacado(cuerpo);
      if (!donde.includes(b.verso)) {
        throw new ErrorPoema(`${archivo}: el verso de <VersoDestacado> no aparece tal cual en el cuerpo:\n${b.verso}`);
      }
    }
    if (b.tipo === 'video') {
      if (!String(b.url ?? '').trim()) throw new ErrorPoema(`${archivo}: <VideoInstagram> tiene url vacía.`);
      try {
        urlPublicaInstagram(b.url!);
      } catch (e) {
        throw new ErrorPoema(`${archivo}: ${e instanceof Error ? e.message : e}`);
      }
      if (!String(b.credito ?? '').trim()) throw new ErrorPoema(`${archivo}: <VideoInstagram> tiene credito vacío.`);
      if (!String(b.leyenda ?? '').trim()) throw new ErrorPoema(`${archivo}: <VideoInstagram> tiene leyenda vacía.`);
    }
  }
  return bloques;
}
