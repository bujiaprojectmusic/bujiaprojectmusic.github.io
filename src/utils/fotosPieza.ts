// Fotos de una pieza (src/content/piezas/**): `fotos[]` del frontmatter es
// la única fuente de src, alt, pie y crédito (los valida el esquema). <Foto
// foto="/piezas/…"> y <FotoCita foto="/piezas/…"> buscan ahí la entrada por
// ruta; el impreso hace lo mismo en scripts/print/sources/piezas.ts.
import { toAssetPath } from './rutasAssets';

export interface FotoPieza {
  src: unknown;
  alt: string;
  pie: string;
  credito: string;
}

/** Ruta bajo src/assets de la entrada, venga como string (kit, export) o como ImageMetadata (colección, con fsPath). */
function rutaDe(src: unknown): string {
  if (typeof src === 'string') return toAssetPath(src).replace(/^\//, '');
  if (src && typeof src === 'object') {
    const o = src as { fsPath?: string; src?: string };
    if (typeof o.fsPath === 'string') return o.fsPath.split('\\').join('/');
    if (typeof o.src === 'string') return o.src.split('?')[0];
  }
  return '';
}

/** Índice (0…) de la foto `foto` en fotos[]; -1 si no está. */
export function indiceFoto(fotos: FotoPieza[], foto: string): number {
  const buscada = toAssetPath(foto).replace(/^\//, '');
  return fotos.findIndex((x) => {
    const r = rutaDe(x.src);
    return r === buscada || r.endsWith(`/${buscada}`);
  });
}

/** Entrada del frontmatter para `foto`; error claro si no está (ahí van su alt, pie y crédito). */
export function fotoDePieza<T extends FotoPieza>(piezaId: string, fotos: T[], quien: string, foto: string): T {
  const i = indiceFoto(fotos, foto);
  if (i < 0) throw new Error(`${piezaId}: <${quien} foto="${foto}">: esa foto no está en el frontmatter fotos[] (ahí van su alt, pie y crédito).`);
  return fotos[i];
}

/** "pie. Foto: crédito" (el mismo texto en web e impreso). */
export function pieDeFoto(x: { pie: string; credito: string }): string {
  return `${x.pie}${x.pie && !/[.!?]$/.test(x.pie.trim()) ? '.' : ''} Foto: ${x.credito}`.trim();
}
