import { defineCollection, z } from 'astro:content';
import { colorSchemes } from '../config/site';

// Nombres de esquema de color válidos en el frontmatter (rosa, acido,
// azul, negro, kraft, etc) — se toman directo de `colorSchemes` en
// site.ts, así que agregar un esquema nuevo ahí alcanza para poder
// usarlo acá sin tocar este archivo.
const colorSchemeNames = Object.keys(colorSchemes) as [
  keyof typeof colorSchemes,
  ...(keyof typeof colorSchemes)[],
];

// Colección "posts": cada volumen del fanzine (o cualquier entrada de blog)
// es un archivo .mdx acá adentro. El frontmatter reemplaza los campos que
// antes venían de Ghost (title, tags, feature_image, etc).
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // Número de volumen del fanzine. Opcional: posts que no son parte de
    // un volumen (ej. un post suelto) pueden omitirlo.
    volume: z.number().int().positive().optional(),
    date: z.date(),
    updated: z.date().optional(),
    // true = layout de fanzine (sin título/imagen default, todo lo controla
    // el propio MDX vía <Portada>, <SectionTitle>, etc — igual que el tag
    // #fanzine en Ghost). false = post normal tipo blog.
    fanzine: z.boolean().default(false),
    colorScheme: z.enum(colorSchemeNames).default('negro'),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    author: z.string().default('Ripper'),
    draft: z.boolean().default(false),
  }),
});

// Colección "hero": slides de la sección debajo del header (una o varias,
// se muestra como slider automáticamente si hay más de una habilitada).
// Cada slide es un archivo .md acá adentro; el cuerpo (si lo hay) se usa
// como texto chico debajo del título.
const hero = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    image: z.string(),
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
    // Apagar una slide (o todas) sin borrar el archivo.
    enabled: z.boolean().default(true),
    // Orden de aparición en el slider (menor primero).
    order: z.number().default(0),
  }),
});

// Colección "catalog": productos y servicios del taller. Cada uno es un
// archivo .md; el cuerpo se usa como descripción larga en la página de
// detalle (/catalogo/[slug]).
const catalog = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    price: z.number().nonnegative().optional(),
    currency: z.string().default('MXN'),
    image: z.string(),
    category: z.enum(['producto', 'servicio']).default('producto'),
    soldOut: z.boolean().default(false),
    // Texto corto para la tarjeta (además de la descripción larga del body).
    excerpt: z.string().optional(),
    enabled: z.boolean().default(true),
    order: z.number().default(0),
  }),
});

// Colección "journal": bitácora/novedades del taller ("Desde el taller",
// sesiones, etc) que se muestra en la home y en /archive. Cada entrada es
// un archivo .md; el cuerpo se usa como contenido completo en la página
// de detalle (/archive/[slug]).
const journal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    // Etiqueta corta tipo "Desde el taller" / "Sesiones" que aparece
    // junto a la fecha en la tarjeta.
    tag: z.string(),
    cover: z.string(),
    excerpt: z.string().optional(),
    author: z.string().default('Ripper'),
    enabled: z.boolean().default(true),
  }),
});

// Colección "about": bloques tipo "¿Qué es [taller]?" (imagen + texto +
// botón) para la home. Cada entrada es un archivo .md o .mdx acá adentro;
// el cuerpo es el párrafo de contenido, así que se puede escribir con
// formato (negritas, links, etc) igual que un post.
const about = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    image: z.string(),
    imageAlt: z.string().optional(),
    // De qué lado va la imagen. Alterná 'left'/'right' entre bloques para
    // que la home no se vea repetitiva (como "¿Qué es...?" vs "Cómo
    // construimos...").
    imagePosition: z.enum(['left', 'right']).default('left'),
    // Esquema de color de este bloque en particular (ver `colorSchemes`
    // en site.ts). Si no se pone, usa taller.about.colorScheme (site.ts).
    colorScheme: z.enum(colorSchemeNames).optional(),
    // Texto chico arriba del botón, ej. "Conoce aquí más sobre nosotrxs:".
    ctaEyebrow: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
    enabled: z.boolean().default(true),
    order: z.number().default(0),
  }),
});

// Colección "guitars": guitarras (y bajos) que construye el taller —
// modelo + precio + specs, independiente del catálogo de pedales/servicios.
// Cada una es un archivo .md; el cuerpo se usa como descripción/specs
// largas debajo de la tarjeta.
const guitars = defineCollection({
  type: 'content',
  schema: z.object({
    model: z.string(),
    price: z.number().nonnegative().optional(),
    currency: z.string().default('MXN'),
    image: z.string(),
    // Categoría corta libre, ej. "Eléctrica" / "Bajo" / "Acústica".
    type: z.string().default('Eléctrica'),
    // Specs cortas para la tarjeta, ej. "Caoba · Humbucker · 25.5\"".
    specs: z.string().optional(),
    soldOut: z.boolean().default(false),
    enabled: z.boolean().default(true),
    order: z.number().default(0),
  }),
});

// Colección "pages": páginas sueltas del sitio (Nosotros, Privacidad,
// Política de cambios, etc) escritas en .mdx para poder usar los mismos
// componentes reutilizables que los posts, en vez de texto plano metido
// a mano en cada .astro. Cada archivo de acá se sirve desde el .astro
// correspondiente en src/pages/ vía StaticPageLayout, que envuelve el
// contenido en <TallerCover> — el mismo "encabezado" tipo portada de
// fanzine que ya usan /catalogo y /guitarras. tag/subtitle/credit/
// colorScheme son las props de ese encabezado: cambiando el frontmatter
// cambiás el estilo del header sin tocar código.
const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tag: z.string().optional(),
    subtitle: z.string().optional(),
    credit: z.string().optional(),
    colorScheme: z.enum(colorSchemeNames).default('rosa'),
  }),
});

export const collections = { posts, hero, catalog, journal, about, guitars, pages };
