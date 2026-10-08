# Componentes para posts (guía de uso)

Elementos reutilizables para armar el contenido de los posts y entradas
del sitio (bitácora en `src/content/journal/`, descripciones de
`src/content/catalog/`, bloques de `src/content/about/` y los posts del
fanzine en `src/content/posts/`). Viven en `src/components/content/` y
están pensados para usarse **dentro del cuerpo de un `.md`/`.mdx`**, junto
con texto normal en Markdown.

## Cómo se usan

1. Tu archivo tiene que ser `.mdx` (no `.md` a secas) para poder importar
   y usar estos componentes — los `.md` sólo soportan Markdown plano.
2. Arriba del todo del archivo, después del frontmatter (`---`), importá
   los que vayas a usar:

   ```mdx
   ---
   title: 'Restauramos una Strat de los 90'
   date: 2026-06-01
   tag: 'Desde el taller'
   cover: '/img/strat-cover.jpg'
   ---

   import PostCover from '../../components/content/PostCover.astro';
   import ImageSide from '../../components/content/ImageSide.astro';
   import Quote from '../../components/content/Quote.astro';

   <PostCover variant="stamp" title="Restauración" tag="Strat '92" colorScheme="acido" />

   Llegó rota de un lado a otro...
   ```

3. La ruta de import (`../../components/content/...`) es la misma sin
   importar en qué colección estés (`journal`, `catalog`, `about`,
   `posts`) — todas viven un nivel adentro de `src/content/`.

Todo lo que sigue son ejemplos copiar/pegar. Los props sin `?` son
obligatorios.

> **Fotos:** van en `src/assets/img/` (en la carpeta que corresponda) y
> se referencian como `"/img/carpeta/archivo.jpg"`, igual que siempre.
> No hace falta achicarlas ni convertirlas: Astro genera al compilar las
> versiones AVIF/WebP en varios tamaños, con `width`/`height` y carga
> lazy, y una versión grande para el PDF del fanzine. Si la ruta no
> existe, el build no se rompe: muestra un recuadro "Imagen pendiente"
> con la ruta y avisa en la consola.

---

## 1. Portadas de post (`PostCover`)

Título grande para abrir un post o una sección larga. 5 variantes:

```mdx
import PostCover from '../../components/content/PostCover.astro';

{/* Sticker: fondo punteado + título tipo calcomanía con sombra dura */}
<PostCover variant="sticker" title="Diario de taller" tag="Vol. 04" colorScheme="acido" />

{/* Stamp: sello de goma, borde doble, todo rotado */}
<PostCover variant="stamp" title="Restaurado" tag="Strat '92" />

{/* Tape: cinta pegada con bordes en zigzag */}
<PostCover variant="tape" title="Sesión en vivo" subtitle="Mayo 2026" colorScheme="rosa" />

{/* Xerox: fotocopiado con un "fantasma" del título detrás, fondo negro */}
<PostCover variant="xerox" title="Fierros y fuzz" tag="Zine" />

{/* Flyer: cartel de tocada, bloque diagonal partido a dos colores */}
<PostCover variant="flyer" title="16 de mayo" tag="Live" colorScheme="azul" />
```

Props: `title` (obligatorio), `subtitle?`, `tag?`, `variant?` (`sticker` |
`stamp` | `tape` | `xerox` | `flyer`, default `sticker`), `colorScheme?`
(`rosa` | `acido` | `azul` | `negro`).

---

## 2. Imágenes

```mdx
import ImageFull from '../../components/content/ImageFull.astro';
import ImageSide from '../../components/content/ImageSide.astro';
import PhotoOld from '../../components/content/PhotoOld.astro';
import Xerox from '../../components/content/Xerox.astro';
import Gallery from '../../components/content/Gallery.astro';
import BeforeAfter from '../../components/content/BeforeAfter.astro';
```

- **`ImageFull`** — foto grande a todo el ancho, tipo portada.
  ```mdx
  <ImageFull src="/img/telecaster-final.jpg" alt="Telecaster terminada" caption="Terminada, mayo 2026" />
  ```
  Si es la primera foto que se ve al entrar a la página (la más grande
  "arriba del todo"), agregale `priority` para que cargue primero en vez
  de lazy — sólo a UNA foto por página:
  ```mdx
  <ImageFull src="/img/telecaster-final.jpg" alt="Telecaster terminada" priority />
  ```
  (`priority` también existe en `ImageSide`, `Xerox`, `PhotoOld` y `Polaroid`.)
- **`ImageSide`** — foto a la izquierda o derecha, el texto la rodea. Metela
  en medio de tus párrafos.
  ```mdx
  <ImageSide src="/img/pastilla.jpg" alt="Pastilla rebobinada" side="left" caption="Rebobinado a mano" />

  Acá seguís escribiendo el párrafo normal, que va a fluir al lado de la foto...
  ```
  Si necesitás cortar el flujo de texto después (por ejemplo antes de un
  `<Divider />` o un `<PostCover />`), agregá `<div style="clear:both" />`.
- **`PhotoOld`** — sepia, viñeta, cinta en las esquinas, para fotos de
  archivo o de hace años.
  ```mdx
  <PhotoOld src="/img/taller-2019.jpg" alt="El taller en 2019" caption="El local, 2019" tilt={2} />
  ```
- **`Xerox`** — foto fotocopiada: blanco y negro de alto contraste, grano y
  sello de "COPIA".
  ```mdx
  <Xerox src="/img/ampli.jpg" alt="Ampli desarmado" caption="Antes de abrirlo" />
  ```
- **`Gallery`** — grilla de fotos tipo "tiradas en la mesa", cada una con
  su propia inclinación.
  ```mdx
  <Gallery images={[
    { src: '/img/proceso-1.jpg', alt: 'Cortando el cuerpo' },
    { src: '/img/proceso-2.jpg', alt: 'Lijando', caption: 'Tres horas de lija' },
    { src: '/img/proceso-3.jpg', alt: 'Pintado' },
  ]} />
  ```
- **`BeforeAfter`** — dos fotos lado a lado con etiquetas, para
  reparaciones/restauraciones.
  ```mdx
  <BeforeAfter before="/img/antes.jpg" after="/img/despues.jpg" alt="Guitarra restaurada" />
  ```

Ya existe además **`Polaroid`** (en `src/components/Polaroid.astro`,
usado en los posts del fanzine) si querés el look clásico de foto
Polaroid con marco blanco:

```mdx
import Polaroid from '../../components/Polaroid.astro';

<Polaroid src="/img/taller-1.jpg" alt="Rebobinando una pastilla" caption="Marzo 2026" tilt={-4} />
```

---

## 2b. Pliegos del fanzine (`Pliego`)

Sólo para los volúmenes del fanzine (`src/content/posts/*.mdx` con
`fanzine: true`). Cada `<Pliego>` es **una página** de media carta; un
volumen tiene exactamente 16, con `n` del 1 al 16 (el mismo número de
página del impreso):

```mdx
import Pliego from '../../components/fanzine/Pliego.astro';

<Pliego n={1} tipo="portada"><Portada volume={1} title="…" image="/img/vol1-cover.jpg" /></Pliego>
<Pliego n={2} tipo="indice"><Indice items={[{ page: "03", title: "Editorial" }]} /></Pliego>
<Pliego n={3} scheme="rosa">
  <SectionTitle scheme="rosa">Editorial</SectionTitle>

  Texto en Markdown, componentes de este archivo, lo que sea.
</Pliego>
<Pliego n={4} bleed="/img/posts/foto.jpg" bleedAlt="…" />   {/* foto a sangre */}
<Pliego n={7} tipo="relleno" />                              {/* TODO, sin contenido aún */}
<Pliego n={15} tipo="fin" />
<Pliego n={16} tipo="contraportada"><Contraportada texto="…" /></Pliego>
```

Props: `n` (obligatorio, 1–16), `tipo?` (`portada` | `indice` | `normal` |
`relleno` | `fin` | `contraportada`, default `normal`), `scheme?` (esquema
de color de esa página), `bleed?` (`true` = sin márgenes interiores, o una
ruta `"/img/…"` para una foto a sangre, con `bleedAlt?`).

Mapa fijo: 1 portada · 2 índice · 3–14 contenido · 15 fin · 16
contraportada. Un pliego sin contenido muestra un placeholder "TODO" (y el
de tipo `fin`, la palabra Fin). Desde el pliego 2, cada página trae el
control "↑ Inicio / ≡ Índice" (anclas a `#pagina-1` y `#pagina-2`, sin
JavaScript, oculto al imprimir). `npm run build` falla si faltan o sobran
pliegos (`scripts/check-volumes.mjs`). El volumen se publica en
`/fanzine/vol-NN` (el número sale de `volume` en el frontmatter).

---

## 3. Encabezados (h2/h3/h4)

No hace falta ningún componente — escribí `##`, `###` o `####` normal en
Markdown y ya salen con estilo punk (siempre que estén dentro de
`.post-body`, que es como se renderizan todos los posts/fichas del
sitio):

```md
## Este es un h2

Se ve grande, en mayúsculas, con la tipografía Anton y una línea gruesa abajo.

### Este es un h3

Sale como un sticker chico con fondo de acento, levemente inclinado.

#### Este es un h4

Sale chico, en mayúsculas, con un `//` al principio (estilo comentario de código).
```

---

## 4. Columnas (`Columnas`)

Ya existía (`src/components/Columnas.astro`), reusalo para cortar un
bloque de texto en 2 o 3 columnas y después seguir en una sola columna
normal — simplemente cerrá el tag y seguís escribiendo abajo:

```mdx
import Columnas from '../../components/Columnas.astro';

<Columnas n={2}>
Acá va el texto que querés en 2 columnas. Podés escribir varios
párrafos normales adentro del bloque.

Este es otro párrafo, sigue dentro de las columnas.
</Columnas>

Y acá ya seguís en una sola columna, como cualquier párrafo normal.
```

Usá `n={3}` para 3 columnas. En mobile siempre cae a 1 columna sola.

---

## 5. Videos (`VideoOldTV`, `VideoCinema`)

Para meter un iframe de YouTube. Pasale sólo el ID del video (lo que
sigue a `v=` en la URL de YouTube), no la URL completa.

```mdx
import VideoOldTV from '../../components/content/VideoOldTV.astro';
import VideoCinema from '../../components/content/VideoCinema.astro';

{/* Tele vieja: marco grueso, antena, perillas, brillo CRT */}
<VideoOldTV id="dQw4w9WgXcQ" title="Tributo a Lagwagon en el taller" />

{/* Cine viejo: perforaciones de rollo a los costados + claqueta arriba */}
<VideoCinema id="dQw4w9WgXcQ" title="Sesión en vivo" clap="Toma 1" />
```

---

## 6. Separadores (`Divider`)

```mdx
import Divider from '../../components/content/Divider.astro';

<Divider variant="zigzag" />  {/* dientes de sierra, como el header */}
<Divider variant="dashed" />  {/* línea punteada gruesa */}
<Divider variant="stars" />   {/* ✦ ✦ ✦ */}
<Divider variant="tape" />    {/* tira de cinta de color */}
```

---

## 7. Citas y notas (`Quote`, `Note`)

```mdx
import Quote from '../../components/content/Quote.astro';
import Note from '../../components/content/Note.astro';

<Quote cite="Ale, cliente del taller">
Quedó sonando mejor que nueva.
</Quote>

<Note variant="note">
Este circuito lo armamos con partes recicladas de tres pedales rotos.
</Note>

<Note variant="warning">
Ojo: este circuito lleva 18V, no 9V.
</Note>

<Note variant="tip" title="Tip del taller">
Si tu pastilla suena apagada, probá primero limpiando los contactos.
</Note>
```

`Note` acepta `title?` para reemplazar la etiqueta default ("Nota" /
"Ojo" / "Tip" según `variant`).

---

## 8. Páginas sueltas del sitio (Nosotros, Servicios, Privacidad, etc)

Estas páginas viven en `src/content/pages/*.mdx` y se ven **igual que
cualquier otra sección del taller** (mismo header y footer del sitio,
mismo "cover" tipo portada de fanzine que ya usan `/catalogo` y
`/guitarras` — banner de color + tag + título tipo sticker + subtítulo).
No usan un layout de fanzine especial: el objetivo es que el sitio se
sienta consistente, y el `.mdx` sólo te da Markdown + la posibilidad de
importar cualquier componente de esta guía si hace falta.

El "cover" (encabezado) se controla **desde el frontmatter**, sin tocar
código — así se puede cambiar el estilo de una página con sólo editar el
`.mdx`:

```mdx
---
title: 'Nosotros'
description: 'Quiénes somos, qué hacemos y por qué en Bujía Project Music.'
tag: 'Nosotros'
subtitle: 'Guitarras, bajos y fierros con actitud punk desde Texcoco'
colorScheme: 'rosa'
---

Bujía Project Music nació de la necesidad de tener un taller donde a los
instrumentos se les trata con respeto...

## Hecho a mano, sin atajos

Podés usar `##`/`###` normal, o importar cualquiera de los componentes
de esta guía (`Quote`, `ImageSide`, `PhotoOld`, etc) si el contenido lo
pide.
```

Frontmatter disponible: `title` (obligatorio, además es el título del
`<TallerCover>`), `description?` (SEO), `tag?`, `subtitle?`, `credit?` y
`colorScheme?` (`rosa` | `acido` | `azul` | `negro`, default `rosa`) —
los mismos props que recibe `TallerCover`.

Para agregar otra página suelta: creá el `.mdx` en
`src/content/pages/`, y en `src/pages/<slug>.astro` copiá el patrón de
`src/pages/nosotros.astro` (`getEntry('pages', '<slug>')` +
`<StaticPageLayout>`).

---

## Dónde se pueden usar

Cualquier colección de contenido (necesita ser `.mdx`, no `.md`):

- `src/content/posts/` — posts del fanzine
- `src/content/journal/` — bitácora del taller (se ve en `/archive`)
- `src/content/catalog/` — descripción larga de productos/servicios (se
  ve en `/catalogo/[slug]`)
- `src/content/about/` — bloques "¿Qué es...?" del home
- `src/content/pages/` — páginas sueltas del sitio (ver punto 8 arriba)
