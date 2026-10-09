# La Jirafa Elektrika — base Astro

Base para migrar el fanzine de Ghost a un sitio estático con **Astro + MDX**,
desplegado en **GitHub Pages**. Reemplaza:

| Ghost | Astro |
|---|---|
| Posts + tag `#fanzine` | `src/content/posts/*.mdx` con `fanzine: true` |
| Snippets (portada, índice, section title...) | Componentes en `src/components/*.astro` |
| Code Injection (print system) | `src/styles/print.css` |
| Theme settings (colores) | `src/config/site.ts` |
| Newsletter / comentarios / member area | **no migrados** (no los usabas) |

## Cómo levantar en local (Docker, sin build)

```bash
docker compose up
```

Esto levanta un contenedor con la imagen oficial `node:20-alpine`, monta el
repo como volumen, corre `npm install` (solo si falta `node_modules`) y
levanta `astro dev` en modo watch — no hay `Dockerfile` ni build de imagen.
El sitio queda en **http://localhost:4321**.

Para parar: `docker compose down`. El `node_modules` vive en un volumen
Docker aparte (`node_modules`), así que no se reinstala cada vez que subís
el contenedor, y no te pisa el bind mount del código.

Si preferís correr sin Docker: `npm install && npm run dev`.

## Piezas y volúmenes (pipeline editorial, issue #13)

Desde el #13 el contenido del fanzine se separa en **piezas** y
**volúmenes**:

- Una **pieza** es una colaboración: `src/content/piezas/<AAAA-MM-slug>/index.mdx`
  con frontmatter validado (`titulo`, `seccion`, `autor`, `credito`,
  `licencia`, `consentimiento_ref`, `paginas`, `fotos`…) y el cuerpo
  marcado por páginas relativas `<Pagina n={1}>` … `<Pagina n={paginas}>`.
  Las fotos van como masters de 2400 px en `src/assets/piezas/<AAAA-MM-slug>/`
  y se declaran en `fotos` (con `alt`, `pie`, `credito`,
  `personas_identificables`); en el cuerpo se ponen con `<Foto n={1} />`
  (o `estilo="side|polaroid|vieja|xerox"`). Sin datos de contacto:
  `consentimiento_ref` es una referencia interna y rechaza correos y
  teléfonos; una clave desconocida rompe el build.
- Un **volumen** es `src/content/volumenes/vol-NN.yml`: `numero`, `titulo`,
  `fecha`, `publishDate`, `colorScheme`, `portada`, y `piezas` en orden con
  la página **final** donde empieza cada una (`desde`). Portada = 1, índice
  = 2 (generado), piezas desde la 3, Fin = N-1, contraportada = N; N se
  calcula (múltiplo de 4). Los huecos se rellenan con páginas diseñadas
  (`colabora | notas | taller`, aviso en el build): en el impreso salen
  diseñadas y en la web no se ven, salvo que se declaren en el yml con
  `{ relleno: notas, desde: 8 }` (entonces también se muestran en
  pantalla); traslapes y piezas `draft` son error.
  `paginas_minimo: 16` rellena hasta ahí aunque sobren páginas.

**Agregar una pieza**: copiá `src/content/piezas/_plantilla.mdx` a
`src/content/piezas/<AAAA-MM-slug>/index.mdx`, llená el frontmatter, poné
las fotos en `src/assets/piezas/<AAAA-MM-slug>/`, escribí el cuerpo en
`<Pagina>` con props literales (nada de expresiones JS: el impreso las
exporta) y dejá `draft: true` hasta que esté aprobada. `npm run
test:content` valida esquemas y composición sin compilar el sitio.

**Armar un volumen**: copiá `src/content/volumenes/_plantilla.yml` a
`vol-NN.yml`, listá las piezas con su `desde` y `draft: false` en las
piezas. `npm run build` compone `/fanzine/vol-NN` (y
`scripts/check-dist-volumenes.mjs` revisa sobre el HTML que los pliegos,
el índice, los créditos y las fotos estén bien); `npm run print` saca
los PDF del mismo yml. `volumen-01.mdx` quedó como legado (`legado: true`):
`/fanzine/vol-01` sale de `vol-01.yml` y `/blog/volumen-01` sigue
redirigiendo.

## Escribir un volumen nuevo (modelo viejo: un MDX con pliegos)

Este modelo sigue valiendo para fixtures como `vol-00`; para contenido
real usá piezas + volúmenes (arriba).

Copiá `src/content/posts/volumen-01.mdx` como punto de partida. El
frontmatter define metadata (`volume`, `date`, `colorScheme`, `tags`...) y
el cuerpo son **16 pliegos** (`<Pliego n={1}>` … `<Pliego n={16}>`), uno
por página de media carta, con este mapa fijo (el mismo del impreso):

| n | tipo | qué va |
|---|---|---|
| 1 | `portada` | `<Portada volume title subtitle image />` |
| 2 | `indice` | `<Indice items={[{ page: "03", title: "…" }, …]} />` — los `page` son los `n` de los pliegos y linkean a `#pagina-N` |
| 3–14 | `normal` (o `relleno` mientras no haya contenido) | texto Markdown, `<SectionTitle>`, `<Columnas>`, `<Polaroid>`, los componentes de `COMPONENTES_MDX.md`… |
| 15 | `fin` | página de Fin (créditos, próximo número) |
| 16 | `contraportada` | `<Contraportada texto="" />` |

```mdx
import Pliego from '../../components/fanzine/Pliego.astro';

<Pliego n={3} scheme="acido">
  <SectionTitle scheme="acido">Editorial</SectionTitle>

  Texto normal en Markdown…
</Pliego>

<Pliego n={7} tipo="relleno" />   {/* placeholder TODO hasta tener contenido */}
```

Cómo se ve: **en la web es una página con scroll vertical continuo**,
una sola columna, con los componentes punk apilados (portada, índice,
piezas, fin, contraportada). No hay doble página ni pasar de página en
pantalla; los `<Pliego tipo="relleno">` (páginas en blanco del
cuadernillo) no se muestran. El índice apunta a `#pagina-N` y hay un
atajo fijo "↑ Inicio / ≡ Índice". **Las páginas existen sólo al
imprimir** (`@media print`: cada `<Pliego>` es una hoja, portada sola,
N páginas con N ≥ 16 y múltiplo de 4). El volumen se sirve en **`/fanzine/vol-NN`** (dos dígitos,
sale del `volume` del frontmatter, no del nombre del archivo ni del
título; `volume` es obligatorio con `fanzine: true`). Las URLs viejas
(`/blog/<archivo>`, `/fanzine/<archivo>`) se generan como redirección
(meta refresh + canonical) y quedan fuera del sitemap. Nada del fanzine
se sirve bajo `/blog/`. Layout propio: `src/layouts/FanzineLayout.astro`.

`npm run build` corre antes `scripts/check-volumes.mjs`, que **falla si un
volumen no tiene N `<Pliego>` con N ≥ 16 y múltiplo de 4, `n` del 1 al N
en orden y sin repetir, y portada/índice/fin/contraportada en las páginas
1, 2, N-1 y N** (también se puede correr solo: `npm run check:volumes`).

### Volumen 00 de prueba (`src/content/posts/vol-00/`)

`/fanzine/vol-00` es un volumen de **20 páginas con contenido ficticio**
que sirve de fixture para probar todo el sistema (pliegos, componentes,
videos con fachada, presupuesto de datos, y más adelante el PDF de Typst).
Tiene `prueba: true` en el frontmatter: eso lo saca del sitemap, del menú y
del archivo `/fanzine`, le pone `noindex,nofollow`, muestra la franja
"EDICIÓN DE PRUEBA" arriba de la página web y, al imprimir, la marca en el
pie de cada página. Todo lo suyo
vive en dos carpetas: `src/content/posts/vol-00/` (el MDX) y
`src/assets/fanzine/vol-00/` (fotos, mascota y `CREDITOS.md`).

- **Apagarlo**: `draft: true` en `src/content/posts/vol-00/index.mdx`
  (deja de generarse).
- **Borrarlo**: borrar esas dos carpetas. Nada más lo referencia.

Componentes disponibles dentro de un pliego:

- `<Portada volume={} title="" subtitle="" image="" />`
- `<Indice items={[{page, title}, ...]} />`
- `<SectionTitle scheme="rosa|acido|azul|negro">...</SectionTitle>`
- `<Columnas n={2|3}>...</Columnas>`
- `<Polaroid src="" alt="" caption="" tilt={-4} />`
- `<Contraportada texto="" />`

`pageBreak` en `<SectionTitle>` ya no hace falta adentro de un pliego (la
página la define el pliego); sigue existiendo para posts sin pliegos. Mete
el salto de página como `<div>`
standalone *antes* del título (nunca en el título mismo — el `clip-path`
del sticker rompe con `break-before` aplicado directo, como ya habías
aprendido en Ghost).

Posts que **no** son de fanzine (`fanzine: false`, el default) usan el
header estándar con título + imagen destacada, igual que un post normal
de Ghost sin el tag `#fanzine`.

## El impreso (Typst)

El fanzine en papel se genera con **Typst** (versión fijada en
`print/TYPST_VERSION`), no con el navegador. Todas las medidas (media carta
396 × 612 pt, sangrado, márgenes, folio, tamaños de letra, páginas múltiplo
de 4) viven en **`print/reglas.json`** y están documentadas, con la hoja de
prueba de impresión y el checklist físico, en
[`docs/IMPRESO.md`](docs/IMPRESO.md). Comandos: `npm run print:install`,
`npm run print` (los dos PDF de cada volumen: pantalla e imprenta, con
chequeos de desborde, índice, ppi, fuentes y QR), `npm run print:test`
(fixtures), `npm run print:prueba` / `print:verify` (hoja de prueba) y
`npm run print:check` (reglas vs docs). Los PDF se generan en CI
(artifacts `fanzine-pdfs` e `impreso-prueba`), se copian a
`dist/fanzine/<slug>/` y no se commitean; en `/fanzine/vol-NN`, debajo
de la portada, va la tarjeta "Llévatelo: este volumen en PDF"
(`DescargaPdf.astro`): "Para leer" (pantalla), "Para imprimir en casa"
(**cuadernillo en carta** a color, a doble cara y engrapar) y, como ligas
chicas, el cuadernillo xerox, la versión xerox página por página, el PDF
de imprenta y "Cómo imprimir", más los pasos para engrapar. Si una pieza
no cabe en su página, el build falla y dice cuál: el texto nunca se achica.
En `/fanzine/colabora` están el **manifiesto** y los **principios y
acuerdo de colaboración editorial** (textos en
`src/content/pages/fanzine-manifiesto.mdx` y `fanzine-acuerdo.mdx`,
ligados desde el header y el footer del fanzine).

## Presupuesto de datos (issue #8)

El fanzine tiene que ser vistoso pero ligero. Los límites viven **sólo en
[`budget.json`](budget.json)** (móvil 390×844, caché vacía, bytes
transferidos comprimidos): primera vista ≤ 300 KB, HTML ≤ 30 KB, CSS ≤ 25 KB,
fuentes ≤ 60 KB, JS ≤ 5 KB y página/volumen completo (scroll hasta el final)
≤ 3 MB. Los PDF descargables no cuentan. `npm run check:budget` sirve `dist/`
con gzip (como GitHub Pages), mide cada página con Chromium (Playwright) y
escribe una tabla por página con las 6 métricas, los recursos más pesados y
las peticiones a terceros. `/fanzine` y cada `/fanzine/vol-NN` **tumban el
CI** si rebasan; `/`, `/nosotros` y `/archive/primera-skatelecaster` sólo
avisan. Corre en `.github/workflows/deploy.yml` en cada PR y en `main`, con
el resumen en el *Job summary*. En local:

```sh
npm run build
npx playwright install chromium   # una vez
npm run check:budget              # sirve dist/ y mide
npm run check:budget -- --url http://localhost:4321   # contra npx astro preview (sin gzip)
npm run check:budget -- --paginas /fanzine/vol-00 --json reporte.json --md resumen.md
```

Si no hay `dist/` corré `npm run build` primero (sin Typst también sirve
para medir: el bloque de descarga sólo dice "PDF no disponible").

## Personalización (colores, tipografía, redes)

Todo vive en `src/config/site.ts`:

- `colorSchemes` → los 4 esquemas punk (rosa/ácido/azul/negro) que se
  aplican por sección vía `scheme-*` en las clases.
- `baseTheme` → color de fondo / tinta / acento general del sitio
  (equivalente a `background_color` / `main_color` del `package.json`
  del theme Xoxo).
- `fonts` → tipografía de cuerpo y de titulares (Space Mono por default).
- `social`, `site` → título, tagline, redes.

La **dirección, el horario, el WhatsApp y la liga al mapa** del taller
viven en `src/data/taller.ts` (único lugar): de ahí salen el footer, el
bloque "Dónde estamos" de /nosotros y los datos estructurados JSON-LD
(`LocalBusiness`). Para cambiar de local u horario, tocá sólo ese archivo.

Los valores se inyectan como CSS custom properties (`--paper`, `--ink`,
`--accent`, `--font-body`, `--font-head`) desde `BaseLayout.astro`, y los
esquemas de color puntuales viven directamente en `src/styles/tokens.css`.

**Importante:** este scaffold reconstruye el sistema visual a partir de lo
que hay en el zip del theme (colores base, tipografía, layout). El CSS/JS
puntual que armaste directo en **Code Injection de Ghost** (los snippets
exactos de portada/índice, el sticker `clip-path` "Xerox Riot" tal cual lo
ajustaste, el JS de Polaroid) no viene en el zip del theme — si me pasás
ese código lo porteo 1:1 en vez de la aproximación que dejé acá.

## Export a PDF

El botón "Descargar PDF" llama `window.print()`. `src/styles/print.css`
define la página en 5.5in × 8.5in con márgenes cero horizontales,
reactiva las columnas explícitamente para impresión, y hace que portada/
índice/contraportada escapen el margen vertical — mismo sistema que ya
tenías en Code Injection, portado a un archivo CSS normal.

## Deploy a GitHub Pages

1. Creá el repo en GitHub y pusheá este proyecto a `main`.
2. En **Settings → Pages**, poné "Source: GitHub Actions".
3. El workflow `.github/workflows/deploy.yml` hace build y deploy solo con
   cada push a `main`. `astro.config.mjs` ya calcula `site`/`base`
   automáticamente a partir de `GITHUB_REPOSITORY` — no hay que tocar nada
   a mano, funciona tanto si el repo es `usuario.github.io` (sitio en raíz)
   como si es un repo normal (`usuario/mi-fanzine`, sitio en `/mi-fanzine/`).

## Pendiente / a tu criterio

- Migrar contenido existente de Ghost a `.mdx` (puedo ayudarte a exportar
  vía la Content API de Ghost y convertir a MDX si querés automatizarlo).
- Búsqueda, RSS, sitemap (el integration de `@astrojs/sitemap` ya está
  instalado, solo falta que le pases `site` — ya configurado).
- Newsletter: si en algún momento lo querés retomar fuera de Ghost, se
  puede enganchar un form a Buttondown/Listmonk/etc. — no está armado acá
  porque dijiste que no le sacás valor.
