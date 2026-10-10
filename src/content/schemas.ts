// ─────────────────────────────────────────────────────────────────────────
// Esquemas zod de las colecciones del fanzine (issue #13): `piezas` y
// `volumenes`. Viven aparte de config.ts para que los reutilice el export
// del impreso (scripts/print/sources/piezas.ts, con tsx): `image()` y
// `reference()` de astro:content se INYECTAN, así que este módulo no
// depende de Astro.
//
// Reglas (issue #13 + comentarios del 8 oct):
// - `.strict()`: una clave desconocida (p. ej. `contacto:`) rompe el build.
// - Ningún dato de contacto: `consentimiento_ref` es una referencia interna
//   ("2026-10-cronica#correo-2026-10-03") y rechaza `@` y 8+ dígitos seguidos.
// - El volumen no fija el total de páginas: piezas en 3…N-2, Fin = N-1,
//   contraportada = N, N múltiplo de 4 (se calcula al componer, ver
//   src/utils/componer.ts). Los huecos se rellenan con páginas diseñadas.
// ─────────────────────────────────────────────────────────────────────────
//  (zod v3, el mismo que usa astro:content): no mezclar con el zod v4 del árbol.
import { z } from 'astro/zod';
import { colorSchemes } from '../config/site';
import { toAssetPath } from '../utils/rutasAssets';

export const SECCIONES = ['cronica-de-taller', 'entrevista', 'resena', 'fotoensayo', 'opinion', 'diy'] as const;
export const LICENCIAS = ['permiso-no-exclusivo', 'cc-by-nc-4.0', 'cc-by-sa-4.0', 'dominio-publico'] as const;
export const RELLENOS = ['colabora', 'notas', 'taller'] as const;
/** Páginas de pieza: 1…12 (piezas en 3…14 de un volumen de 16; con N mayor hay más lugar). */
export const PAGINAS_PIEZA_MAX = 12;
export const PRIMERA_PAGINA_PIEZA = 3;

const colorSchemeNames = Object.keys(colorSchemes) as [keyof typeof colorSchemes, ...(keyof typeof colorSchemes)[]];

/** Sin `@` (correos) ni 8+ dígitos seguidos (teléfonos). */
export const CONSENTIMIENTO_RE = /^(?!.*@)(?!.*\d{8,})[\w.#:/ -]+$/u;
export const consentimientoRef = z
  .string()
  .min(3)
  .refine((v) => !v.includes('@'), { message: 'consentimiento_ref no puede ser un correo (lleva "@"): va una referencia interna, p. ej. "2026-10-cronica#correo-2026-10-03".' })
  .refine((v) => !/\d{8,}/.test(v), { message: 'consentimiento_ref no puede ser un teléfono (8 o más dígitos seguidos): va una referencia interna.' })
  .refine((v) => CONSENTIMIENTO_RE.test(v), { message: 'consentimiento_ref: sólo letras, números, ".", "#", ":", "/", "-" y espacios.' });

type ImageFn = () => z.ZodTypeAny;

/** Campo de imagen escrito como "/piezas/<carpeta>/foto.jpg" (vive en src/assets/piezas/). */
const imagenPieza = (image: ImageFn) => z.string().transform(toAssetPath).pipe(image());

export function piezaSchema(image: ImageFn) {
  return z
    .object({
      titulo: z.string().min(1),
      seccion: z.enum(SECCIONES),
      autor: z.string().min(1),
      /** Línea de crédito tal como sale impresa, p. ej. "Texto y fotos: Ripper". */
      credito: z.string().min(1),
      bio: z.string().max(280).optional(),
      /** Red o URL pública del autor. No sale en el impreso. */
      redes: z.string().optional(),
      licencia: z.enum(LICENCIAS).default('permiso-no-exclusivo'),
      consentimiento_ref: consentimientoRef,
      /** Cuántas páginas de media carta ocupa la pieza (= cantidad de <Pagina> en el MDX). */
      paginas: z.number().int().min(1).max(PAGINAS_PIEZA_MAX),
      fotos: z
        .array(
          z
            .object({
              src: imagenPieza(image),
              alt: z.string().min(1, 'cada foto necesita alt (texto alternativo) no vacío'),
              pie: z.string(),
              credito: z.string().min(1),
              personas_identificables: z.boolean(),
            })
            .strict(),
        )
        .default([]),
      /** Videos/playlists de la pieza: el título es obligatorio (leyenda del QR). */
      multimedia: z
        .array(z.object({ tipo: z.enum(['video', 'playlist']), id: z.string().min(1), titulo: z.string().min(1) }).strict())
        .default([]),
      scheme: z.enum(colorSchemeNames).optional(),
      draft: z.boolean().default(false),
    })
    .strict();
}

export function volumenSchema(image: ImageFn, reference: (c: 'piezas') => z.ZodTypeAny) {
  return z
    .object({
      numero: z.number().int().nonnegative(),
      titulo: z.string().min(1),
      /** Mes del volumen (AAAA-MM-DD, se muestra mes y año). */
      fecha: z.coerce.date(),
      /** Fecha de publicación (para el cron). */
      publishDate: z.coerce.date(),
      colorScheme: z.enum(colorSchemeNames).default('negro'),
      descripcion: z.string().optional(),
      portada: z
        .object({
          /** Foto a sangre (5.75 × 8.75 in): ≥ 2625 px de lado largo para 300 ppi; recomendado 2700. Opcional mientras no haya foto. */
          imagen: imagenPieza(image).optional(),
          alt: z.string().default(''),
          credito: z.string().optional(),
          subtitulo: z.string().optional(),
        })
        .strict(),
      /** Orden de piezas con su página final de inicio, y rellenos declarados. */
      piezas: z
        .array(
          z.union([
            z.object({ pieza: reference('piezas'), desde: z.number().int().min(PRIMERA_PAGINA_PIEZA) }).strict(),
            z.object({ relleno: z.enum(RELLENOS), desde: z.number().int().min(PRIMERA_PAGINA_PIEZA) }).strict(),
          ]),
        )
        .min(1),
      /** Mínimo de páginas (múltiplo de 4): si las piezas no llegan, se rellena hasta ahí. Opcional; el total nunca se fija. */
      paginas_minimo: z.number().int().min(8).multipleOf(4).optional(),
      contraportada: z
        .object({
          texto: z.string().default('Bujía Project Music — Texcoco, MX'),
          // Créditos del volumen (issue #7): una línea por entrada.
          creditos: z.array(z.string().min(1)).default([]),
        })
        .strict()
        .default({}),
      impreso: z.object({ multimedia: z.enum(['qr', 'omitir']).default('qr') }).strict().default({}),
      prueba: z.boolean().default(false),
      draft: z.boolean().default(false),
    })
    .strict();
}

export type Seccion = (typeof SECCIONES)[number];
export type Relleno = (typeof RELLENOS)[number];
