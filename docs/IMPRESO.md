# El impreso: reglas, hoja de prueba y cómo se genera

Esto documenta la base del fanzine **en papel** (issue #16). La web no
cambia: desde el PR #24 es scroll continuo y las "páginas" existen sólo
al imprimir. El impreso se genera con **Typst** (versión fijada en
`print/TYPST_VERSION`), sin Paged.js, Playwright ni impresión del navegador.

- **Única fuente de las medidas**: `print/reglas.json`. Ningún `.typ` ni
  script escribe a mano tamaño de hoja, sangrado, márgenes, folio ni
  tamaños de letra: todo se lee de ahí (`print/lib/base.typ` con `json()`,
  los scripts con `scripts/print/lib/reglas.mjs`).
- Las tablas de la sección **Reglas** de este archivo se generan desde el
  JSON (`npm run print:check -- --write`) y CI falla si no coinciden
  (`npm run print:check`).
- Los PDF **no se commitean**: se generan en `print/build/` (ignorada por
  git) y, en CI, se suben como artifact `impreso-prueba`.

## Comandos

```bash
npm run print:install   # baja Typst (versión de print/TYPST_VERSION) y verifica su sha256
npm run print:prueba    # genera los 4 PDF de prueba en print/build/
npm run print:verify    # verifica los PDF con poppler (pdfinfo, pdffonts, pdftoppm, pdftotext)
npm run print:check     # reglas.json coherente y tablas de este doc al día
```

`print:install` sólo instala el binario fijado de Linux x86_64 (el de CI). En
otra plataforma instalá la **misma** versión a mano (brew, cargo, release) y
dejala en `PATH` o en `TYPST_BIN`; el build rechaza cualquier otra versión.
Typst corre siempre con `--font-path print/fonts --ignore-system-fonts`: sólo
se embeben las fuentes del repo (Anton y Space Mono, con sha256 en
`print/fonts/SHA256SUMS`), y con `--creation-timestamp $SOURCE_DATE_EPOCH`
(0 si no está) para que dos compilaciones den el mismo sha256.

Salidas de `npm run print:prueba`:

| Archivo | Variante | Hoja |
|---|---|---|
| `print/build/jirafa-prueba-impresion.pdf` | pantalla | 396 × 612 pt, sin sangrado ni marcas |
| `print/build/jirafa-prueba-impresion-imprenta.pdf` | imprenta | 450 × 666 pt, TrimBox 396 × 612 a 27 pt, BleedBox 414 × 630 a 18 pt, marcas de corte |
| `print/build/jirafa-prueba-impresion-bn.pdf` | bn | 396 × 612 pt, todo en escala de grises |
| `print/build/jirafa-prueba-doble-cara.pdf` | — | carta horizontal 792 × 612 pt, 2 caras |

(Los números de esta tabla son los de `reglas.json`; si cambian ahí,
`print:verify` y `print:check` lo delatan.)

Typst no escribe TrimBox/BleedBox: `scripts/print/build-prueba.mjs` las
agrega a la variante imprenta con `pdf-lib` después de compilar. Las marcas
de corte empiezan en el borde del BleedBox (a 9 pt del corte) y van 18 pt
hacia afuera: no entran en el sangrado.

## Reglas

<!-- reglas:inicio -->
<!-- GENERADO desde print/reglas.json (v2) con `npm run print:check -- --write`. No editar a mano. -->

### 1. Formato

| Elemento | pt | in | mm | Nota |
|---|---|---|---|---|
| Corte (TrimBox), vertical | 396 × 612 | 5.5 × 8.5 | 139.70 × 215.90 | vertical (media carta) |
| Sangrado (por lado) | 9 | 0.125 | 3.17 | BleedBox 414 × 630 pt |
| Hoja de imprenta (MediaBox) | 450 × 666 | 6.25 × 9.25 | 158.75 × 234.95 | TrimBox a 27 pt del borde; BleedBox a 18 pt |
| Marcas de corte | grosor 0.25, largo 18 | 0.25 (largo) | 6.35 | empiezan en el borde del BleedBox (9 pt del corte) y van 18 pt hacia afuera; no entran en el sangrado; sólo en la variante imprenta |
| Pantalla / B/N (MediaBox) | 396 × 612 | 5.5 × 8.5 | 139.70 × 215.90 | sin sangrado ni marcas |
| Cuadernillo (hoja física) | 792 × 612 | 11 × 8.5 | 279.40 × 215.90 | carta horizontal, 2 páginas por cara, doble cara, voltear por el borde corto |

### 2. Páginas

| Regla | Valor |
|---|---|
| Total N | múltiplo de 4; mínimo 4; recomendado 12–24; más de 28 → aviso (no falla); tope: ninguno |
| Portada | 1 |
| Índice | 2 |
| Piezas | 3 … N-2 |
| Fin | N-1 |
| Contraportada | N |
| Pliego central | N/2 y N/2+1 (único par continuo en papel; la única doble página donde una foto puede cruzar el lomo) |
| Relleno | si el contenido no cierra en múltiplo de 4, páginas de relleno diseñadas antes del Fin; nunca texto inventado |
| Ejemplo N = 20 | portada 1, índice 2, piezas 3–18, pliego central 10–11, Fin 19, contraportada 20 |

Orden de impresión del cuadernillo para N = 20 (hoja: frente | vuelta; cada cara lleva dos páginas, izquierda | derecha):

| Hoja | Frente | Vuelta |
|---|---|---|
| 1 | 20 \| 1 | 2 \| 19 |
| 2 | 18 \| 3 | 4 \| 17 |
| 3 | 16 \| 5 | 6 \| 15 |
| 4 | 14 \| 7 | 8 \| 13 |
| 5 | 12 \| 9 | 10 \| 11 |

### 3. Márgenes

| Margen | pt | in | mm |
|---|---|---|---|
| Superior | 36 | 0.5 | 12.70 |
| Inferior | 45 | 0.625 | 15.88 |
| Exterior | 36 | 0.5 | 12.70 |
| Interior (lomo) | 45 | 0.625 | 15.88 |
| Caja de texto | 315 × 531 | 4.375 × 7.375 | 111.13 × 187.32 |
| Zona segura (desde el corte) | 18 | 0.25 | 6.35 |
| Lomo mínimo | 27 | 0.375 | 9.52 |

Encuadernación: `binding: left`. impar = derecha (recto), lomo a la izquierda; par = izquierda (verso), lomo a la derecha. Creep: no se compensa: con 4–6 hojas de bond de 75–90 g desplaza menos de 0.5 mm y lo absorbe el margen exterior.

### 4. Tipografía

Fuentes: títulos **Anton**, texto **Space Mono** (Regular, Bold, Italic, BoldItalic). Alineación: izquierda (sin justificar: monoespaciada). Idioma `es`, guiones: sí. Escalar texto para que quepa: **nunca** (el texto nunca se achica para que quepa: nada de scale() sobre texto ni tamaños por debajo de minimo_pt; si no cabe, el build falla (#9)).

| Estilo | Uso | Fuente | Tamaño (pt) | Interlínea | Mínimo (pt) |
|---|---|---|---|---|---|
| `cuerpo_1col` | Cuerpo, 1 columna | Space Mono regular | 9.5 | 13.5 pt | 9 |
| `cuerpo_2col` | Cuerpo, 2 columnas | Space Mono regular | 9 | 12.5 pt | 9 |
| `pie` | Pies de foto, créditos, leyenda de QR | Space Mono regular | 7.5 | 10 pt | 7 |
| `folio` | Folio | Space Mono bold | 8 | — | 7 |
| `indice` | Entradas del índice | Space Mono regular | 10 | 14 pt | 9 |
| `titulo` | Título de pieza | Anton regular | 22–48 | × 1.05 | 18 |
| `subtitulo` | Subtítulo (h3) | Anton regular | 13 | × 1.1 | 12 |
| `calado` | Texto calado (claro sobre negro/color) | Space Mono bold | 10 | — | 10 |

Medida: 54 caracteres por línea (máximo 60) en 315 pt. Columnas: máximo 2, separación 12 pt, ancho mínimo 140 pt; las 3 columnas de la web se imprimen en 2. Viudas y huérfanas: costo alto.

### 5. Folio

| Regla | Valor |
|---|---|
| Fuente | Space Mono bold, 8 pt, 2 dígitos (01, 02, …) |
| Posición | margen exterior; línea base a 27 pt (9.52 mm) del corte inferior |
| Visible en | páginas 2 … N-1 (no en portada ni contraportada) |
| Sobre fotos a sangre | pestaña blanca sólida, relleno 3 pt |

### 6. Imágenes

| Regla | Valor |
|---|---|
| Resolución objetivo | 300 ppi al tamaño impreso |
| Advertencia | 150–299 ppi |
| Error | menos de 150 ppi |
| Variante pantalla | 150 ppi, JPEG calidad 75 |
| Portada a sangre | 5.75 × 8.75 in → mínimo 2625 px de alto (recomendado 2700) |
| Formatos | jpeg, png, webp, svg |
| Color | sRGB (impresión digital/copistería; no se convierte a CMYK) |
| Texturas | vectoriales (tiling de Typst, formas); sin filtros SVG rasterizados |
| Originales | nunca se editan; las variantes viven en print/build/ (ignorada por git) |

### 7. Blanco y negro (fotocopia)

| Regla | Valor |
|---|---|
| Esquema | xerox |
| Punto negro / blanco | 5 % / 95 % |
| Gamma | 1.1 |
| Fondo gris mínimo | 15 % (menos desaparece en la copia) |
| Negro sólido | como máximo 25 % de la página |
| Texto sobre | blanco o negro sólido; nunca sobre medio tono ni foto |
| Hoja | 396 × 612 pt, sin sangrado ni marcas |

### Hoja de prueba (`print/prueba.typ`)

| Elemento | Valor |
|---|---|
| Muestras Space Mono | 7 pt, 7.5 pt, 8 pt, 9 pt, 9.5 pt, 10 pt, 12 pt |
| Muestras Anton | 12 pt, 18 pt, 24 pt, 36 pt |
| Cadena de prueba | `ñ á é í ó ú ü ¿ ¡` |
| Calado | 10 pt |
| QR | 0.6 in → https://bujiaprojectmusic.com/fanzine/vol-01 |
| Foto de muestra | src/assets/img/nosotros/IMG_2408.jpeg, 2 × 2 in a 300 y 150 ppi |
| Escala de grises | 0–100 % en pasos de 10 % |
| Páginas | 4 (folio en 2 … 3) |
| Doble cara | cruces a 36 pt de cada borde, 36 pt de largo |

<!-- reglas:fin -->

## Hoja de prueba de impresión

`print/prueba.typ` (4 páginas) sirve para calibrar la impresora o la
copistería antes de mandar un volumen:

1. Reglas en pulgadas y en centímetros, cuadro de 1 × 1 in, guías rotuladas
   de corte, sangrado, zona segura y caja de texto.
2. Muestras de Space Mono y Anton en los tamaños de `reglas.prueba`, con
   `ñ á é í ó ú ü ¿ ¡`, las cuatro variantes de Space Mono, un bloque de
   texto calado y el folio de muestra (página 2 y 3; no en 1 ni en 4).
3. La misma foto a 300 y a 150 ppi efectivos, escala de grises de 0 a 100 %
   y un QR de 0.6 in con su leyenda.
4. Notas.

`print/prueba-doble-cara.typ` es una hoja carta horizontal con dos caras
(FRENTE / VUELTA), cruces de registro numeradas en espejo y la leyenda
"voltear por el borde corto".

### Prueba física (checklist)

Imprimir `jirafa-prueba-impresion.pdf` (o la variante imprenta si la
copistería corta) **al 100 %**, sin "ajustar a página" ni "encoger al área
imprimible", en el papel que se va a usar.

- [ ] La regla de 1 in mide **25.4 mm** y el cuadro negro **25.4 × 25.4 mm**
      (±0.3 mm). Si no, la impresora está escalando: revisar el diálogo.
- [ ] La regla de 10 cm mide 100 mm.
- [ ] Los **7 pt** de Space Mono se leen a distancia de lectura; los 9 pt
      (cuerpo) se leen sin esfuerzo. Si los 7 pt se empastan, la copistería
      no sirve para pies de foto.
- [ ] Las cuatro esquinas de la **zona segura** (línea verde, 18 pt del
      corte) están dentro del área imprimible; nada se cortó.
- [ ] El **texto calado** (blanco sobre negro) se lee sin que las letras se
      cierren.
- [ ] La **escala de grises**: se distinguen los pasos de 10 a 90 %; los
      fondos de menos de 15 % desaparecen en fotocopia (esperado: por eso
      el texto va sobre blanco o negro sólido).
- [ ] La foto a 300 ppi se ve nítida; la de 150 ppi es el límite aceptable.
- [ ] El QR se lee con el teléfono.
- [ ] El **folio** queda a 27 pt (9.5 mm) del borde inferior, al margen
      exterior, en las páginas 2 y 3 y no en la 1 ni la 4.
- [ ] Variante imprenta: las marcas de corte quedan fuera del sangrado y la
      hoja mide 450 × 666 pt (158.75 × 234.95 mm).
- [ ] `jirafa-prueba-doble-cara.pdf` a doble cara, **voltear por el borde
      corto**: a contraluz, cada cruz cae sobre la cruz del mismo número
      (±1 mm). Si caen cruzadas (1 sobre 2), la impresora volteó por el
      borde largo.
- [ ] Fotocopiar `jirafa-prueba-impresion-bn.pdf` en la copistería: la
      escala de grises sigue completa y el calado se lee.

## CI

El job `impreso` de `.github/workflows/deploy.yml` corre en cada PR y en
`main`: instala Typst con el script (caché por versión + sha256), instala
`poppler-utils`, corre `print:check`, `print:prueba` y `print:verify`, y
sube los cuatro PDF como artifact **`impreso-prueba`**. Si el sha256 del
binario no coincide, el job falla antes de compilar.

## Qué reutiliza el motor del volumen (#9)

- `print/lib/base.typ`: `configurar(paginas: N)` (hoja, márgenes
  inside/outside con `binding: left`, folio, estilos de texto), `tinta()`
  (color → gris en B/N), `fondo-sangre()`, `marcas-de-corte()`, `estilo()`,
  `pie`, `cuerpo-2col`, `calado`, `columnas-2`.
- `scripts/print/lib/reglas.mjs`: `revisarPaginas(N)` (múltiplo de 4 y
  mínimo son error; más de 28 sólo avisa), `paginasFijas(N)`,
  `cuadernillo(N)` (orden de impresión), `hojaDePagina(p, N)`.
- `scripts/print/build-prueba.mjs`: `typstBin()`, `verificarFuentes()`,
  `compilar()`, `cajasImprenta()`.
