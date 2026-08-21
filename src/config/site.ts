// ─────────────────────────────────────────────────────────────────────────
// Configuración central del sitio y del tema.
// Esto reemplaza el panel "Theme settings" de Ghost: acá se tocan colores,
// tipografía, textos del footer y redes sociales sin tener que ir a buscar
// clases CSS por todos lados.
// ─────────────────────────────────────────────────────────────────────────

export const site = {
  title: 'Bujia Project Music',
  tagline: 'Taller de ajuste, reparacion, custom y construccion de guitarras y bajos',
  description:
    'Desde Texcoco, Estado de Mexico para el mundo, puro PANK!!',
  lang: 'es',
  locale: 'es_MX',
};

export const social = {
  instagram: 'https://instagram.com/bujiaprojectmusic',
  whatsapp: 'https://wa.me/message/PRMKHTDNWYD3I1',
  discord: '',
  email: '',
};

// ─────────────────────────────────────────────────────────────────────────
// Config del sitio del TALLER (Bujía Project Music) — header y elementos
// comunes de las páginas de taller/servicios, separado del fanzine.
// Todo lo que aparece en el header (logo, redes, menú, botón de cuenta,
// íconos del header fijo) se controla desde acá, sin tocar el componente.
// ─────────────────────────────────────────────────────────────────────────
export const taller = {
  // Orden de las secciones de la home (src/pages/index.astro). Reordená
  // este array para cambiar el orden en la página sin tocar código —
  // sacá una clave para quitar esa sección de la home (sigue existiendo,
  // simplemente no se renderiza ahí). Claves válidas: 'hero' | 'about' |
  // 'catalog' | 'journal'.
  homeSections: ['hero', 'about', 'guitars', 'catalog', 'journal'] as const,

  // Colores de "chrome" del sitio: el fondo general detrás de todas las
  // secciones y el de las piezas fijas (header, barra de anuncios,
  // footer) que NO siguen el colorScheme de cada sección. Cambiá los hex
  // acá — no hace falta tocar ningún archivo .css.
  theme: {
    // Fondo de las páginas del taller, visible en los huecos entre
    // secciones (arriba del hero, entre catálogo y journal, etc).
    pageBackground: '#F1F0EB',
    // Franja de arriba del todo del header (logo + redes + menú), la
    // primera que se ve al entrar al sitio.
    headerTopBackground: '#F1F0EB',
    // Píldora del menú, header fijo al hacer scroll y submenú desplegable.
    headerBackground: '#ffffff',
    // Barra de anuncios arriba del header.
    announcementBackground: '#000000',
    // Footer.
    footerBackground: '#000000',
  },

  logo: {
    // Si `image` tiene un path (relativo a la carpeta public/, ej.
    // "/img/logo.svg" — sin el prefijo "/public"), se usa esa imagen.
    // Si se deja vacío, se usa `text` con el estilo
    // "cursiva en óvalo" del diseño como placeholder.
    text: 'Bujía',
    image: '/img/logo.png',
    alt: 'Bujía Project Music',
    href: '/',
    // Color del óvalo y del texto placeholder (independiente del --accent
    // del resto del sitio). No aplica si `image` está seteado.
    color: '#ff5b52',
  },

  // Redes sociales que aparecen como íconos en el header completo.
  // `name` debe existir en <Icon /> (facebook | instagram | whatsapp).
  social: [
    { name: 'facebook', href: 'https://facebook.com/bujiaprojectmusic', label: 'Facebook' },
    { name: 'instagram', href: 'https://instagram.com/bujiaprojectmusic', label: 'Instagram' },
    { name: 'whatsapp', href: 'https://wa.me/message/PRMKHTDNWYD3I1', label: 'WhatsApp' },
  ] as { name: 'facebook' | 'instagram' | 'whatsapp'; href: string; label: string }[],

  // Ítems del menú principal (barra tipo píldora / menú fijo al hacer scroll).
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Nosotros', href: '/nosotros' },
    { label: 'Servicios', href: '/catalogo' },
    //{ label: 'Blog', href: '/archive' },
  ],

  // Buscador (ícono de lupa) en el header completo.
  search: {
    enabled: false,
  },

  // Botón/link de cuenta ("UNIRSE") en el header completo.
  account: {
    enabled: false,
    label: 'Unirse',
    href: '/unirse',
  },

  // Íconos del header FIJO que aparece al scrollear hacia abajo
  // (reemplaza al header completo mientras se navega la página).
  fixedHeader: {
    home: { enabled: true, href: '/' },
    share: { enabled: false },
    search: { enabled: false },
  },

  // Sección debajo del header con una o varias slides (foto + título +
  // botón). Las slides salen de src/content/hero/*.md — acá sólo se
  // prende/apaga la sección entera. Cada slide se prende/apaga individual
  // con su propio `enabled` en el frontmatter.
  hero: {
    enabled: false,
  },

  // Sección "¿Qué es [taller]?" (imagen + texto + botón) debajo del hero.
  // Los bloques salen de src/content/about/*.md(x) — acá sólo se
  // prende/apaga la sección entera. Cada bloque se prende/apaga individual
  // con su propio `enabled` en el frontmatter.
  about: {
    enabled: true,
    // Esquema de color (rosa | acido | azul | negro).
    colorScheme: 'carbon' as const,
  },

  // Sección "Guitarras que construimos" — modelos + precios, con su
  // propio esquema de color y ubicación en homeSections (independiente
  // de about y de catalog). Los modelos salen de src/content/guitars/*.md.
  // `limit` es cuántos se muestran antes del botón "Ver todas".
  guitars: {
    enabled: false,
    title: 'Guitarras que construimos',
    subtitle: 'Cada una hecha a mano, a pedido, en el taller',
    limit: 6,
    ctaLabel: 'Ver todas',
    ctaHref: '/guitarras',
    // Esquema de color de la sección (rosa | acido | azul | negro).
    colorScheme: 'negro' as const,
  },

  // Sección de catálogo (productos + servicios) debajo del hero. Los
  // ítems salen de src/content/catalog/*.md. `limit` es cuántos se
  // muestran en la home antes del botón "Ver todo" (que linkea a
  // /catalogo, con el listado completo).
  catalog: {
    enabled: true,
    title: 'Nuestros servicios',
    subtitle: 'Conoce los servicios que ofrecemos para tu instrumento',
    limit: 6,
    ctaLabel: 'Ver todo',
    ctaHref: '/catalogo',
    // Esquema de color de la sección (rosa | acido | azul | negro, ver
    // colorSchemes acá abajo).
    colorScheme: 'taller' as const,
  },

  // Sección "Desde el taller" debajo del catálogo, con novedades/posts.
  // Salen de src/content/journal/*.md. `limit` es cuántos se muestran en
  // la home antes del botón "Ver todos" (que linkea a /archive, con el
  // listado completo).
  journal: {
    enabled: false,
    title: 'Desde el taller',
    subtitle: 'Sesiones, reparaciones y cosas que armamos por acá',
    limit: 4,
    ctaLabel: 'Ver todos',
    ctaHref: '/archive',
    // El "pizarrón" donde vive esta sección: fondo verde oscuro con
    // textura de tiza, para que no se pierda contra el fondo cream del
    // resto del sitio. Cambiá los hex acá.
    background: '#1f3d2b',
    ink: '#fdf8e7',
  },

  // Barra de anuncios arriba del header: franja negra angosta con
  // mensajes que se pueden navegar con las flechitas (y opcionalmente
  // rotan solas). `enabled: false` la saca del todo del sitio.
  announcementBar: {
    enabled: true,
    messages: ['¡Ajuste y reparacion para tu guitarra o bajo!', 'Customizacion para tu instrumento', 'Somos guitar tech'],
    // Cada cuántos ms cambia de mensaje solo. 0 (o null) desactiva el
    // autoplay y sólo se navega con las flechitas.
    autoplayMs: 5000,
  },

  // Footer del sitio: fondo negro, igual al header fijo. Cada bloque se
  // puede prender/apagar por separado sin tocar el componente.
  footer: {
    // Formulario de newsletter. `action` es opcional: si tu proveedor
    // (Mailchimp, Klaviyo, etc.) te da una URL de submit, ponela ahí;
    // si se deja vacío el form no envía nada (placeholder visual).
    newsletter: {
      enabled: false,
      title: 'Suscríbete al taller',
      placeholder: 'Correo electrónico',
      action: '',
    },

    // Datos de contacto del taller físico. Cualquier campo vacío no se
    // muestra. Poné acá lo que la gente necesita para pasar o escribir.
    contact: {
      enabled: true,
      address: 'Zacatecas 39, San Nicolas Huexotla, Texcoco, Edo. de México',
      phone: '5618622447',
      email: 'bujiaprojectmusic@gmail.com',
      hours: 'Lun a jue, 12:00--19:30, Vie a Sab 10:00--15:30',
    },

    // Links legales/institucionales (política de privacidad, cambios y
    // garantías, términos, etc). Agregá o quitá los que necesites.
    legalLinks: [
      { label: 'Políticas y garantías', href: '/politica-y-garantias' },
    ],
  },
};

// Esquemas de color punk (rosa / ácido / azul / negro / kraft / etc) para
// los títulos de sección tipo sticker y las portadas del taller. Cambiá
// los hex acá y se propagan solos a todo el sitio: las clases CSS
// ".scheme-<nombre>" se generan a partir de este objeto (ver
// ColorSchemeStyles.astro), así que para agregar un esquema nuevo basta
// con agregarlo acá abajo.
export const colorSchemes = {
  rosa: {
    ink: '#1a1a1a',
    accent: '#ff2f92',
    paper: '#fff0f6',
  },
  acido: {
    ink: '#1a1a1a',
    accent: '#d4ff2f',
    paper: '#f7ffe0',
  },
  azul: {
    ink: '#1a1a1a',
    accent: '#2f6bff',
    paper: '#eaf1ff',
  },
  negro: {
    ink: '#ffffff',
    accent: '#ffcc00',
    paper: '#111111',
  },
  bujia: {
    ink: '#171512',
    accent: '#e94b3c',
    paper: '#f3e8c8',
  },

  // Fanzine fotocopiado clásico.
  // Prácticamente blanco y negro con amarillo de marcador.
  xerox: {
    ink: '#111111',
    accent: '#f5c518',
    paper: '#f4f0e6',
  },

  // Flyer punk impreso sobre papel amarillo.
  flyer: {
    ink: '#111111',
    accent: '#e33b32',
    paper: '#f2c94c',
  },

  // Cutting mat / mesa de trabajo.
  // Perfecto para "Desde el taller".
  taller: {
    ink: '#f5edda',
    accent: '#f5c518',
    paper: '#234638',
  },

  // Rojo deslavado de impresión.
  // Muy bueno para bloques agresivos y CTA.
  rojo: {
    ink: '#171512',
    accent: '#f3d34a',
    paper: '#df4b3f',
  },

  // Papel azul de fotocopia / flyer.
  // Inspirado también en el overol de Bujía.
  overol: {
    ink: '#111111',
    accent: '#f4c430',
    paper: '#78a9b8',
  },

  // Papel kraft/cartón.
  // Muy taller, empaques, etiquetas y manuales.
  kraft: {
    ink: '#191713',
    accent: '#d94738',
    paper: '#c8a66a',
  },

  // Fotocopia invertida.
  // Para secciones muy punk sin ser negro puro.
  carbon: {
    ink: '#f2ead8',
    accent: '#e94b3c',
    paper: '#191919',
  },

  // Papel naranja de flyer barato.
  // Úsalo poco porque llama muchísimo la atención.
  naranja: {
    ink: '#161616',
    accent: '#e83f35',
    paper: '#ef8d32',
  },

  // Fanzine verdoso / papel reciclado.
  // Más apagado y editorial.
  oliva: {
    ink: '#171713',
    accent: '#e94b3c',
    paper: '#c7ca8b',
  },
} as const;

export type ColorSchemeName = keyof typeof colorSchemes;

// Colores base del sitio (fuera del contenido de los posts): equivalen a
// background_color / main_color del package.json del theme Xoxo original.
export const baseTheme = {
  background: '#E8E1D2',
  main: '#E8E1D2',
  ink: '#000000',
};

// Tipografía. bodyFont es Space Mono como en el theme actual; headFont queda
// separado por si en algún volumen querés un display distinto.
export const fonts = {
  body: '"Space Mono", ui-monospace, monospace',
  head: '"Space Mono", ui-monospace, monospace',
};

// Tamaño de página para exportar volúmenes a PDF (mismo formato que ya
// definiste en Code Injection: 5.5in x 8.5in, cero márgenes horizontales).
export const printPage = {
  width: '5.5in',
  height: '8.5in',
};
