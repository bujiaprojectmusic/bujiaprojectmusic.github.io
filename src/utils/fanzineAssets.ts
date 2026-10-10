// ─────────────────────────────────────────────────────────────────────────
// Assets de marca del fanzine (issue #7): mascota, parche, stickers y
// cintas en SVG, hechos por el bot de Diseño y aprobados por Ricardo. Van
// en src/assets/fanzine/<nombre>.svg y se INCRUSTAN en el HTML (set:html)
// para que funcionen `currentColor` y las variables --ink/--accent/--paper.
//
// Si un archivo todavía no está en el repo, se usa un placeholder neutro
// (forma mínima en currentColor marcada TODO) y el build no se rompe: con
// sólo copiar el SVG a src/assets/fanzine/ con el nombre esperado, aparece.
// ─────────────────────────────────────────────────────────────────────────

/** Nombres esperados (ver comentario del 8 oct 2026 en el issue #7). */
export const ASSETS = {
  'mascota-jirafa-mono': 'Mascota (una tinta, currentColor): portada y contraportada',
  'mascota-jirafa-3tintas': 'Mascota con --ink, --tone, --accent, --paper',
  'mascota-escena-taller-mono': 'Escena del taller (interiores; fondo negro: cuidado con el tóner)',
  'parche-bujia-color': 'Parche ovalado 197×84, color',
  'parche-bujia-mono': 'Parche ovalado 197×84, una tinta',
  'parche-bujia-ancho-color': 'Parche 260×84 (header), color',
  'parche-bujia-ancho-mono': 'Parche 260×84 (header), una tinta',
  'cinta-adhesiva': 'Cinta adhesiva',
  'sello-copia': 'Sello "COPIA"',
  'etiqueta-vol': 'Etiqueta de volumen (<text id="vol-num">)',
  'bujia-chispa': 'Sticker: bujía con chispa',
  rayo: 'Sticker: rayo',
  pua: 'Sticker: púa',
  'llave-inglesa': 'Sticker: llave inglesa',
  'estrella-medio-tono': 'Sticker: estrella de medio tono',
  'patron-medio-tono': 'Patrón de medio tono (máscara CSS)',
} as const;
export type NombreAsset = keyof typeof ASSETS;

const crudos = import.meta.glob('/src/assets/fanzine/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function limpiar(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>\s*/i, '')
    .replace(/<!DOCTYPE[^>]*>\s*/i, '')
    .trim();
}

/** SVG real del asset, o null si no está en src/assets/fanzine/. */
export function svgAsset(nombre: string): string | null {
  const ruta = `/src/assets/fanzine/${nombre}.svg`;
  const svg = crudos[ruta];
  return svg ? limpiar(svg) : null;
}

export function hayAsset(nombre: string): boolean {
  return `/src/assets/fanzine/${nombre}.svg` in crudos;
}

/** Los que faltan hoy (para el PR y para /fanzine/muestra). */
export function assetsFaltantes(): NombreAsset[] {
  return (Object.keys(ASSETS) as NombreAsset[]).filter((n) => !hayAsset(n));
}

// ── Placeholders (TODO): formas mínimas, neutras, en currentColor ────────
const TODO = '<!-- TODO: placeholder; poné el SVG del bot de Diseño en src/assets/fanzine/ -->';

function placeholderMascota(): string {
  // Silueta geométrica genérica (cabeza + cuello + cuerpo), sin arte.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" role="img" aria-label="Mascota (pendiente)" data-placeholder="mascota">${TODO}
<g fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="10 7">
<circle cx="78" cy="30" r="20"/><path d="M70 48 L46 120"/><rect x="18" y="118" width="72" height="56" rx="18"/><path d="M32 174 v18 M76 174 v18"/>
</g><text x="60" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="currentColor">TODO</text></svg>`;
}

function placeholderSticker(nombre: string): string {
  const etiqueta = nombre.replace(/-/g, ' ').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" data-placeholder="${nombre}">${TODO}
<circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="12 8"/>
<text x="60" y="56" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="11" fill="currentColor">${etiqueta}</text>
<text x="60" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="currentColor">TODO</text></svg>`;
}

function placeholderCinta(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 36" aria-hidden="true" data-placeholder="cinta-adhesiva" preserveAspectRatio="none">${TODO}
<rect x="0" y="0" width="160" height="36" fill="currentColor" opacity="0.45"/>
<path d="M0 0 L160 36 M0 18 L160 36 M0 0 L160 18" stroke="currentColor" stroke-width="1" opacity="0.15"/></svg>`;
}

function placeholderEtiquetaVol(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" data-placeholder="etiqueta-vol">${TODO}
<circle cx="60" cy="60" r="56" fill="currentColor" opacity="0.12"/><circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="14 8"/>
<text x="60" y="52" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="13" fill="currentColor">VOL.</text>
<text id="vol-num" x="60" y="92" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="44" fill="currentColor">00</text></svg>`;
}

function placeholderPatron(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" data-placeholder="patron-medio-tono">${TODO}<circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>`;
}

/**
 * SVG a incrustar: el asset real o su placeholder. `esPlaceholder` sirve
 * para marcar en el HTML (data-placeholder) lo que falta.
 */
export function svgMarca(nombre: NombreAsset | string): { svg: string; esPlaceholder: boolean } {
  const real = svgAsset(nombre);
  if (real) return { svg: real, esPlaceholder: false };
  let svg: string;
  if (nombre.startsWith('mascota')) svg = placeholderMascota();
  else if (nombre === 'cinta-adhesiva') svg = placeholderCinta();
  else if (nombre === 'etiqueta-vol') svg = placeholderEtiquetaVol();
  else if (nombre === 'patron-medio-tono') svg = placeholderPatron();
  else svg = placeholderSticker(nombre);
  return { svg, esPlaceholder: true };
}

/** etiqueta-vol.svg trae <text id="vol-num">07</text>: se reemplaza el número. */
export function etiquetaVolumen(volumen: number): { svg: string; esPlaceholder: boolean } {
  const { svg, esPlaceholder } = svgMarca('etiqueta-vol');
  const nn = String(volumen).padStart(2, '0');
  return { svg: svg.replace(/(<text\b[^>]*\bid="vol-num"[^>]*>)[^<]*(<\/text>)/, `$1${nn}$2`), esPlaceholder };
}
