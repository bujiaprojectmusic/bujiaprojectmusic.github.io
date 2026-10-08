# La Jirafa Eléctrica — base Astro

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

## Escribir un volumen nuevo

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

Cómo se ve: en móvil cada pliego va a todo el ancho, uno debajo de otro;
en desktop (≥ 1024 px) se agrupan como revista abierta — página 1 sola,
(2–3), (4–5) … (14–15) y 16 sola. Desde el pliego 2 hay un control
"↑ Inicio / ≡ Índice" (anclas, sin JavaScript). El volumen se sirve en **`/fanzine/vol-NN`** (dos dígitos,
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
del archivo `/fanzine`, le pone `noindex,nofollow` y muestra la marca
"EDICIÓN DE PRUEBA" en la portada y en el pie de cada pliego. Todo lo suyo
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
