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

// Los prefijos y toAssetPath() viven en rutasAssets.ts (módulo puro, sin
// import.meta.glob) y se re-exportan desde acá para no cambiar los imports.
export { PUBLIC_PREFIX, ASSETS_PREFIX, FANZINE_PREFIX, FANZINE_ASSETS_PREFIX, PIEZAS_PREFIX, PIEZAS_ASSETS_PREFIX, toAssetPath } from './rutasAssets';
import { PUBLIC_PREFIX, ASSETS_PREFIX, FANZINE_PREFIX, FANZINE_ASSETS_PREFIX, PIEZAS_PREFIX, PIEZAS_ASSETS_PREFIX, toAssetPath } from './rutasAssets';

// Mapa "/src/assets/img/foo.jpg" → módulo con el ImageMetadata (eager:
// se resuelve una sola vez al compilar; no hay que importar cada foto).
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/{img,fanzine,piezas}/**/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,avif,gif,svg}',
  { eager: true },
);

export type ImageSource = string | ImageMetadata | null | undefined;

export function isImageMetadata(src: unknown): src is ImageMetadata {
  return typeof src === 'object' && src !== null && 'src' in src && 'width' in src && 'height' in src;
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
      : k.startsWith(PIEZAS_ASSETS_PREFIX)
        ? PIEZAS_PREFIX + k.slice(PIEZAS_ASSETS_PREFIX.length)
        : PUBLIC_PREFIX + k.slice(ASSETS_PREFIX.length),
  );
}
