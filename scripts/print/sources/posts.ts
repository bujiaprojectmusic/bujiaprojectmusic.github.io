// Adaptador "posts": lee los volúmenes como existen hoy en main
// (src/content/posts/**/index.mdx o volumen-NN.mdx con `fanzine: true`),
// con sus <Pliego n=… tipo=…>. Cuando entre #13 (colecciones piezas /
// volumenes) se agrega otro adaptador al lado con la misma interfaz y
// export.ts elige; Typst no se entera.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface FuenteVolumen {
  /** Ruta del .mdx relativa a la raíz del repo. */
  archivo: string;
  slug: string;
  frontmatter: Record<string, any>;
  /** Cuerpo MDX sin frontmatter. */
  cuerpo: string;
  /** Líneas que ocupa el frontmatter (para reportar línea real en errores). */
  lineaBase: number;
}

export function volumeSlug(volume: number): string {
  return `vol-${String(volume).padStart(2, '0')}`;
}

function listarMdx(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listarMdx(p) : e.name.endsWith('.mdx') ? [p] : [];
  });
}

export function leerFuente(raiz: string, archivo: string): FuenteVolumen {
  const abs = path.resolve(raiz, archivo);
  const src = fs.readFileSync(abs, 'utf8');
  const { data, content, matter: fm } = matter(src);
  const lineaBase = fm ? fm.split('\n').length + 1 : 0; // --- + fm + ---
  if (typeof data.volume !== 'number') {
    throw new Error(`${archivo}: un volumen con fanzine: true necesita \`volume\` (la URL es /fanzine/vol-NN).`);
  }
  return { archivo: path.relative(raiz, abs), slug: volumeSlug(data.volume), frontmatter: data, cuerpo: content, lineaBase };
}

/** Volúmenes publicables (fanzine: true, sin draft). */
export function listarVolumenes(raiz: string): FuenteVolumen[] {
  const out: FuenteVolumen[] = [];
  for (const f of listarMdx(path.join(raiz, 'src', 'content', 'posts'))) {
    const src = fs.readFileSync(f, 'utf8');
    const { data } = matter(src);
    if (!data.fanzine || data.draft) continue;
    out.push(leerFuente(raiz, f));
  }
  const vistos = new Map<string, string>();
  for (const v of out) {
    if (vistos.has(v.slug)) throw new Error(`Dos volúmenes con el mismo número (${v.slug}): ${vistos.get(v.slug)} y ${v.archivo}.`);
    vistos.set(v.slug, v.archivo);
  }
  return out.sort((a, b) => a.frontmatter.volume - b.frontmatter.volume);
}
