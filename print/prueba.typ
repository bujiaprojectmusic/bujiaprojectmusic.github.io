// Hoja de prueba de impresión de La Jirafa Eléctrica (issue #16).
// Se compila en 3 variantes (pantalla / imprenta / bn) con:
//   typst compile --root . --font-path print/fonts --ignore-system-fonts \
//     --input variante=imprenta print/prueba.typ print/build/jirafa-prueba-impresion-imprenta.pdf
// Las fotos y el QR de muestra los prepara scripts/print/build-prueba.mjs
// en print/build/cache/ (no se commitean). Todas las medidas salen de
// /print/reglas.json a través de base.typ.
#import "/print/lib/base.typ": *

#let P = reglas.prueba
#let N = P.paginas
#let sufijo = if es-bn { "-bn" } else { "" }
#let etiqueta = (pantalla: "PANTALLA", imprenta: "IMPRENTA (sangrado + marcas)", bn: "B/N XEROX").at(variante)

#show: configurar.with(paginas: N, fondo: p => { guias(); guia-caja(p) })

// Regla en pulgadas (horizontal) y en cm (vertical), desde el corte.
#let regla-in(largo: 4) = {
  let ticks = ()
  for i in range(largo * 8 + 1) {
    let x = i / 8 * 1in
    let h = if calc.rem(i, 8) == 0 { 14pt } else if calc.rem(i, 4) == 0 { 9pt } else { 5pt }
    ticks.push(place(top + left, dx: x, line(angle: 90deg, length: h, stroke: (paint: negro, thickness: if calc.rem(i, 8) == 0 { 1pt } else { 0.4pt }))))
    if calc.rem(i, 8) == 0 {
      ticks.push(place(top + left, dx: x + 2pt, dy: 14pt, text(font: fuente-texto, size: pt(estilos.pie.pt), str(calc.quo(i, 8)) + " in")))
    }
  }
  box(width: largo * 1in + 1pt, height: 26pt, stroke: (top: 1pt + negro), ticks.join())
}
#let regla-cm(largo: 10) = {
  let ticks = ()
  for i in range(largo * 10 + 1) {
    let y = i * 1mm
    let w = if calc.rem(i, 10) == 0 { 14pt } else if calc.rem(i, 5) == 0 { 9pt } else { 5pt }
    ticks.push(place(top + left, dy: y, line(length: w, stroke: (paint: negro, thickness: if calc.rem(i, 10) == 0 { 1pt } else { 0.4pt }))))
    if calc.rem(i, 10) == 0 {
      ticks.push(place(top + left, dx: 15pt, dy: y - 3pt, text(font: fuente-texto, size: pt(estilos.pie.pt), str(calc.quo(i, 10)) + " cm")))
    }
  }
  box(width: 40pt, height: largo * 1cm + 1pt, stroke: (left: 1pt + negro), ticks.join())
}

// ── Página 1: reglas, cuadro de 1 in, guías ────────────────────────────
= Hoja de prueba de impresión
#text(size: pt(estilos.cuerpo_1col.pt))[La Jirafa Eléctrica · variante *#etiqueta* · Typst #sys.version · reglas.json v#reglas.version]

#v(6pt)
#regla-in()
#v(4pt)
#grid(columns: (44pt, 1fr), column-gutter: 8pt,
  regla-cm(),
  [
    // Cuadro de 1 × 1 in, negro sólido: al rasterizar a 300 dpi debe medir 300 × 300 px.
    #rect(width: inch(P.cuadro_in), height: inch(P.cuadro_in), fill: negro)
    #pie[Cuadro de #str(P.cuadro_in) × #str(P.cuadro_in) in (debe medir #str(P.cuadro_in * 25.4) × #str(P.cuadro_in * 25.4) mm en papel; #str(P.cuadro_in * reglas.imagenes.ppi_objetivo) × #str(P.cuadro_in * reglas.imagenes.ppi_objetivo) px a #str(reglas.imagenes.ppi_objetivo) dpi).]
    #v(6pt)
    #pie[
      Guías (líneas punteadas, rotuladas): *corte* #str(reglas.formato.corte.ancho_pt) × #str(reglas.formato.corte.alto_pt) pt ·
      *sangrado* #str(reglas.formato.sangrado_pt) pt ·
      *zona segura* #str(reglas.margenes.zona_segura_pt) pt ·
      *caja de texto* #str(reglas.margenes.caja_texto.ancho_pt) × #str(reglas.margenes.caja_texto.alto_pt) pt
      (márgenes #str(reglas.margenes.superior_pt) / #str(reglas.margenes.inferior_pt) / exterior #str(reglas.margenes.exterior_pt) / interior #str(reglas.margenes.interior_pt) pt).
      #if es-imprenta [Marcas de corte: #str(reglas.formato.marcas_corte.grosor_pt) pt de grosor, #str(reglas.formato.marcas_corte.largo_pt) pt de largo, desde #str(reglas.formato.marcas_corte.inicio_desde_corte_pt) pt del corte.] else [Sin sangrado ni marcas en esta variante.]
    ]
  ])

#v(1fr)
#pie[Imprimir al 100 % (sin "ajustar a página"). Checklist completo en docs/IMPRESO.md.]

#pagebreak()

// ── Página 2: muestras tipográficas, calado, folio ─────────────────────
= Tipografía
#for s in P.muestras_space_mono_pt [
  #block(spacing: 4pt, text(font: fuente-texto, size: pt(s))[#str(s) pt — Space Mono: #P.cadena El veloz murciélago hindú comía feliz cardillo y kiwi.])
]
#block(spacing: 4pt, text(font: fuente-texto, size: pt(estilos.cuerpo_1col.pt), weight: "bold")[#str(estilos.cuerpo_1col.pt) pt — Space Mono Bold: #P.cadena])
#block(spacing: 4pt, text(font: fuente-texto, size: pt(estilos.cuerpo_1col.pt), style: "italic")[#str(estilos.cuerpo_1col.pt) pt — Space Mono Italic: #P.cadena])
#block(spacing: 4pt, text(font: fuente-texto, size: pt(estilos.cuerpo_1col.pt), weight: "bold", style: "italic")[#str(estilos.cuerpo_1col.pt) pt — Space Mono Bold Italic: #P.cadena])
#v(4pt)
#for s in P.muestras_anton_pt [
  #block(spacing: 3pt, text(font: fuente-titulos, size: pt(s))[#str(s) pt — Anton #P.cadena])
]
#v(6pt)
#calado[Texto calado a #str(estilos.calado.pt) pt: Space Mono Bold, claro sobre negro sólido. #P.cadena]
#v(6pt)
#pie[Mínimos duros: cuerpo #str(estilos.cuerpo_1col.minimo_pt) pt · pies #str(estilos.pie.minimo_pt) pt · folio #str(estilos.folio.minimo_pt) pt · título #str(estilos.titulo.minimo_pt) pt · calado #str(estilos.calado.minimo_pt) pt. El folio de muestra de esta página (abajo, al margen exterior) va en Space Mono Bold #str(reglas.folio.pt) pt con la línea base a #str(reglas.folio.linea_base_desde_corte_inferior_pt) pt del corte.]

#pagebreak()

// ── Página 3: fotos a 300 y 150 ppi, escala de grises, QR ──────────────
= Imágenes
#grid(columns: (1fr, 1fr), column-gutter: pt(reglas.tipografia.columnas.separacion_pt),
  [
    #image("/print/build/cache/foto-300" + sufijo + ".jpg", width: inch(P.foto_lado_in))
    #pie[300 ppi efectivos: #str(int(P.foto_lado_in * 300)) px en #str(P.foto_lado_in) in. Foto: Bujía Project Music (#P.foto).]
  ],
  [
    #image("/print/build/cache/foto-150" + sufijo + ".jpg", width: inch(P.foto_lado_in))
    #pie[150 ppi efectivos: #str(int(P.foto_lado_in * 150)) px en #str(P.foto_lado_in) in (límite inferior; menos de #str(reglas.imagenes.ppi_error_menor_a) ppi es error).]
  ])
#v(8pt)
== Escala de grises
#escala-grises()
#pie[De 0 % a 100 % en pasos de #str(P.grises_paso_pct) %. En B/N (fotocopia) los fondos de menos de #str(reglas.bn.gris_minimo_fondo_pct) % desaparecen; el texto va sobre blanco o negro sólido.]
#v(8pt)
== QR de muestra
#grid(columns: (auto, 1fr), column-gutter: 10pt,
  image("/print/build/cache/qr-muestra.svg", width: inch(P.qr_in)),
  pie[QR de #str(P.qr_in) in: #P.qr_url \ Leyenda de QR en pie de #str(estilos.pie.pt) pt.])

#pagebreak()

// ── Página 4 (= N, sin folio): notas ───────────────────────────────────
= Notas
- Páginas por volumen: múltiplo de #str(reglas.paginas.multiplo); 1 portada, 2 índice, N-1 Fin, N contraportada. Esta hoja tiene #str(N) páginas: el folio aparece en 2 y 3, no en 1 ni en 4.
- Variante B/N: punto negro #str(reglas.bn.punto_negro_pct) %, punto blanco #str(reglas.bn.punto_blanco_pct) %, gamma #str(reglas.bn.gamma); negro sólido como máximo #str(reglas.bn.negro_solido_max_pct_pagina) % de la página.
- Imágenes: objetivo #str(reglas.imagenes.ppi_objetivo) ppi; #str(reglas.imagenes.ppi_advertencia_desde)–#str(reglas.imagenes.ppi_advertencia_hasta) advertencia; menos de #str(reglas.imagenes.ppi_error_menor_a) error.
- Fuentes embebidas: Anton y Space Mono (Regular, Bold, Italic, Bold Italic), de google/fonts `2eb0b48d`.
#v(1fr)
#align(center, text(font: fuente-titulos, size: pt(estilos.titulo.pt))[Bujía Project Music, Texcoco, MX])
