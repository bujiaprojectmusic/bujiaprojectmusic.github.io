// Rutas de imágenes tal como se escriben en MDX/frontmatter ("/img/…",
// "/fanzine/…", "/piezas/…") → ruta real bajo src/assets/. Módulo puro,
// sin import.meta.glob, para que lo puedan importar los esquemas
// (src/content/schemas.ts) y el export del impreso fuera de Vite.
export const PUBLIC_PREFIX = '/img/';
export const ASSETS_PREFIX = '/src/assets/img/';
export const FANZINE_PREFIX = '/fanzine/';
export const FANZINE_ASSETS_PREFIX = '/src/assets/fanzine/';
// Fotos de las piezas (issue #13): masters de 2400 px en src/assets/piezas/<AAAA-MM-slug>/.
export const PIEZAS_PREFIX = '/piezas/';
export const PIEZAS_ASSETS_PREFIX = '/src/assets/piezas/';

// "/img/x.jpg" → "/src/assets/img/x.jpg". Rutas que ya apuntan a
// src/assets se dejan como están; cualquier otra se devuelve igual.
export function toAssetPath(src: string): string {
  const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL?.replace(/\/$/, '')) || '';
  let path = src.trim();
  if (base && path.startsWith(`${base}/`)) path = path.slice(base.length);
  if (path.startsWith(PUBLIC_PREFIX)) return ASSETS_PREFIX + path.slice(PUBLIC_PREFIX.length);
  if (path.startsWith(FANZINE_PREFIX)) return FANZINE_ASSETS_PREFIX + path.slice(FANZINE_PREFIX.length);
  if (path.startsWith(PIEZAS_PREFIX)) return PIEZAS_ASSETS_PREFIX + path.slice(PIEZAS_PREFIX.length);
  return path;
}
