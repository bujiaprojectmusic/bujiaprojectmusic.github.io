// ─────────────────────────────────────────────────────────────────────────
// Puente entre las rutas "/img/..." que se escriben en los MDX/frontmatter
// y las imágenes reales, que viven en src/assets/img/ para que Astro las
// procese al compilar (astro:assets: AVIF/WebP, srcset, width/height).
//
// Antes todas las fotos estaban en public/img/ y se servían tal cual
// salían del celular (3–6 MB cada una). Ahora están en src/assets/img/
// con la MISMA estructura de carpetas, así que en los MDX se sigue
// escribiendo `src="/img/nosotros/IMG_2408.jpeg"` y este helper devuelve
// el ImageMetadata que necesitan <Image>/<Picture>/getImage().
//
// Para agregar una foto nueva: copiarla a src/assets/img/<carpeta>/ y
// referenciarla como "/img/<carpeta>/archivo.jpg". Nada más.
// ─────────────────────────────────────────────────────────────────────────
import type { ImageMetadata } from 'astro';

export const PUBLIC_PREFIX = '/img/';
export const ASSETS_PREFIX = '/src/assets/img/';
// Assets del fanzine (fotos por volumen, mascota): "/fanzine/vol-00/x.jpg"
// → src/assets/fanzine/vol-00/x.jpg.
export const FANZINE_PREFIX = '/fanzine/';
export const FANZINE_ASSETS_PREFIX = '/src/assets/fanzine/';

// Mapa "/src/assets/img/foo.jpg" → módulo con el ImageMetadata (eager:
// se resuelve una sola vez al compilar; no hay que importar cada foto).
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/{img,fanzine}/**/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,avif,gif,svg}',
  { eager: true },
);

export type ImageSource = string | ImageMetadata | null | undefined;

export function isImageMetadata(src: unknown): src is ImageMetadata {
  return typeof src === 'object' && src !== null && 'src' in src && 'width' in src && 'height' in src;
}

// "/img/x.jpg" → "/src/assets/img/x.jpg". Rutas que ya apuntan a
// src/assets se dejan como están; cualquier otra se devuelve igual.
export function toAssetPath(src: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  let path = src.trim();
  if (base && path.startsWith(`${base}/`)) path = path.slice(base.length);
  if (path.startsWith(PUBLIC_PREFIX)) return ASSETS_PREFIX + path.slice(PUBLIC_PREFIX.length);
  if (path.startsWith(FANZINE_PREFIX)) return FANZINE_ASSETS_PREFIX + path.slice(FANZINE_PREFIX.length);
  return path;
}

// Para no repetir la misma advertencia en cada página que use la foto.
const warned = new Set<string>();

/**
 * Devuelve el ImageMetadata de una ruta "/img/..." (o lo pasa tal cual si
 * ya es un import de imagen). Si el archivo no existe devuelve undefined y
 * avisa UNA vez en la consola del build — el componente que lo llame
 * decide qué mostrar (placeholder, nada, etc). Así una foto que todavía
 * no se subió no rompe el build, pero tampoco pasa desapercibida.
 */
export function resolveImage(src: ImageSource, context?: string): ImageMetadata | undefined {
  if (!src) return undefined;
  if (isImageMetadata(src)) return src;
  const key = toAssetPath(src);
  const hit = images[key]?.default;
  if (hit) return hit;
  if (!warned.has(key)) {
    warned.add(key);
    const where = context ? ` (${context})` : '';
    console.warn(
      `[resolveImage] No existe la imagen "${src}"${where}. ` +
        `Se esperaba en ${key.replace(/^\//, '')}. Se muestra un placeholder.`,
    );
  }
  return undefined;
}

/** Lista de rutas disponibles (para debug / tests). */
export function availableImages(): string[] {
  return Object.keys(images).map((k) =>
    k.startsWith(FANZINE_ASSETS_PREFIX)
      ? FANZINE_PREFIX + k.slice(FANZINE_ASSETS_PREFIX.length)
      : PUBLIC_PREFIX + k.slice(ASSETS_PREFIX.length),
  );
}
