// Contexto de la pieza que se está renderizando (issue #13). Lo escribe
// src/pages/fanzine/[slug].astro antes de pintar el <Content /> de cada
// pieza y lo leen <Pagina> (para saber en qué página final cae su n
// relativo) y <Foto> (para sacar la foto n del frontmatter). Astro
// compila las rutas de a una (build.concurrency = 1), así que un módulo
// con estado alcanza y el MDX de la pieza no necesita expresiones.
import type { CollectionEntry } from 'astro:content';

export interface PiezaActual {
  pieza: CollectionEntry<'piezas'>;
  /** Página final donde empieza la pieza. */
  desde: number;
  /** Esquema de color del volumen (si la pieza no trae el suyo). */
  scheme?: string;
  /** Marca "EDICIÓN DE PRUEBA" (volumen prueba: true). */
  prueba: boolean;
}

let actual: PiezaActual | null = null;

export function setPiezaActual(p: PiezaActual | null) {
  actual = p;
}

export function getPiezaActual(quien: string): PiezaActual {
  if (!actual) {
    throw new Error(`<${quien}> sólo se usa dentro de una pieza (src/content/piezas/**) compuesta por un volumen (src/content/volumenes/*.yml).`);
  }
  return actual;
}
