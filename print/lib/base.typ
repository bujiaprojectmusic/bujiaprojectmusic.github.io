// ─────────────────────────────────────────────────────────────────────────
// Base del impreso de La Jirafa Eléctrica (issue #16). Lee TODAS las
// medidas de /print/reglas.json: tamaño de hoja, sangrado, márgenes
// (inside/outside con binding: left), folio y estilos de texto. Ningún
// número de página, margen ni tamaño de letra se escribe acá a mano.
//
// Variantes (se eligen con `typst compile --input variante=…`):
//   pantalla  → hoja = corte (formato.corte), sin sangrado ni marcas
//   imprenta  → hoja = mediabox_imprenta (corte + offset_trim por lado), marcas de
//               corte fuera del sangrado; TrimBox/BleedBox las pone
//               scripts/print/build-prueba.mjs (pdf-lib) después
//   bn        → como pantalla, todo en escala de grises (luma)
//
// Lo reutiliza el motor de #9: `#import "/print/lib/base.typ": *` y
// `#show: configurar.with(paginas: N)`.
// Compilar siempre con --root <raíz del repo> para que /print/... resuelva.
// ─────────────────────────────────────────────────────────────────────────
#let reglas = json("/print/reglas.json")
#let variante = sys.inputs.at("variante", default: "pantalla")
#let es-bn = variante == "bn"
#let es-imprenta = variante == "imprenta"

#let pt(v) = v * 1pt
#let inch(v) = v * 1in

// ── Geometría (todo desde reglas.json) ─────────────────────────────────
#let corte-w = pt(reglas.formato.corte.ancho_pt)
#let corte-h = pt(reglas.formato.corte.alto_pt)
#let sangrado = if es-imprenta { pt(reglas.formato.sangrado_pt) } else { 0pt }
// Distancia del borde de la hoja al corte (27 pt en imprenta, 0 en las demás).
#let off = if es-imprenta { pt(reglas.formato.mediabox_imprenta.offset_trim_pt) } else { 0pt }
#let hoja-w = if es-imprenta { pt(reglas.formato.mediabox_imprenta.ancho_pt) } else { corte-w }
#let hoja-h = if es-imprenta { pt(reglas.formato.mediabox_imprenta.alto_pt) } else { corte-h }
#let margen = reglas.margenes
#let zona-segura = pt(margen.zona_segura_pt)
#let caja-w = pt(margen.caja_texto.ancho_pt)
#let caja-h = pt(margen.caja_texto.alto_pt)
#let estilos = reglas.tipografia.estilos
#let fuente-texto = reglas.tipografia.fuentes.texto
#let fuente-titulos = reglas.tipografia.fuentes.titulos

// ── Color: en B/N todo pasa a gris (luma) ──────────────────────────────
#let tinta(c) = {
  let col = rgb(c)
  if es-bn {
    let (r, g, b, ..) = col.components()
    luma(0.2126 * r + 0.7152 * g + 0.0722 * b)
  } else { col }
}
#let negro = tinta("#000000")
#let blanco = tinta("#ffffff")

// ── Marcas de corte (sólo imprenta): 8 líneas de `largo_pt`, de
//    `grosor_pt`, que empiezan a `inicio_desde_corte_pt` del corte (el
//    borde del BleedBox) y salen hacia el borde de la hoja. ─────────────
#let marcas-de-corte() = {
  if not es-imprenta { return }
  let mc = reglas.formato.marcas_corte
  let g = pt(mc.grosor_pt)
  let largo = pt(mc.largo_pt)
  let ini = pt(mc.inicio_desde_corte_pt)
  let s = (paint: black, thickness: g, cap: "butt")
  let xs = (off, off + corte-w)
  let ys = (off, off + corte-h)
  for x in xs {
    // verticales, arriba y abajo
    place(top + left, dx: x, dy: off - ini - largo, line(angle: 90deg, length: largo, stroke: s))
    place(top + left, dx: x, dy: off + corte-h + ini, line(angle: 90deg, length: largo, stroke: s))
  }
  for y in ys {
    // horizontales, izquierda y derecha
    place(top + left, dx: off - ini - largo, dy: y, line(length: largo, stroke: s))
    place(top + left, dx: off + corte-w + ini, dy: y, line(length: largo, stroke: s))
  }
}

// ── Folio: dos dígitos, Space Mono Bold, al margen exterior, línea base a
//    `linea_base_desde_corte_inferior_pt` del corte inferior, visible en
//    2 … N-1. Sobre una pestaña blanca sólida (fotos a sangre). ─────────
#let folio(pagina, total) = {
  let f = reglas.folio
  if pagina == 1 { return }
  if total != none and pagina >= total { return }
  let texto = if pagina < 10 and f.digitos == 2 { "0" + str(pagina) } else { str(pagina) }
  let recto = calc.odd(pagina)
  let relleno = pt(f.pestana_relleno_pt)
  let cuerpo = pt(f.pt)
  // La caja tiene `relleno` abajo del texto y la fuente ~0.25 em de
  // descendente: la línea base queda a linea_base ± 1 pt del corte.
  let dy = -(off + pt(f.linea_base_desde_corte_inferior_pt) - relleno - 0.25 * cuerpo)
  let dx = off + pt(margen.exterior_pt)
  let caja = box(fill: if f.pestana_blanca_sobre_sangre { blanco } else { none }, inset: relleno,
    text(font: f.fuente, weight: "bold", size: cuerpo, fill: negro, texto))
  if recto {
    place(bottom + right, dx: -dx, dy: dy, caja)
  } else {
    place(bottom + left, dx: dx, dy: dy, caja)
  }
}

// ── Fondo a sangre: cubre el BleedBox (en pantalla/bn, el corte). Va en
//    page.background o page.foreground. ─────────────────────────────────
#let fondo-sangre(body) = {
  let s = if es-imprenta { pt(reglas.formato.sangrado_pt) } else { 0pt }
  place(top + left, dx: off - s, dy: off - s,
    box(width: corte-w + 2 * s, height: corte-h + 2 * s, clip: true, body))
}

// ── Configuración de página y texto ────────────────────────────────────
// `paginas`: total N del volumen (para esconder el folio en la última).
// `fondo`: función (pagina) => contenido extra del fondo (opcional).
#let configurar(doc, paginas: none, fondo: none) = {
  let cuerpo = estilos.cuerpo_1col
  set page(
    width: hoja-w,
    height: hoja-h,
    margin: (
      top: off + pt(margen.superior_pt),
      bottom: off + pt(margen.inferior_pt),
      inside: off + pt(margen.interior_pt),
      outside: off + pt(margen.exterior_pt),
    ),
    binding: left,
    background: context {
      let p = counter(page).get().first()
      if fondo != none { fondo(p) }
      marcas-de-corte()
      folio(p, paginas)
    },
  )
  set text(
    font: fuente-texto,
    size: pt(cuerpo.pt),
    lang: reglas.tipografia.lang,
    hyphenate: reglas.tipografia.guiones,
    fill: negro,
  )
  // Interlínea nominal: `interlinea_pt` de línea base a línea base.
  set par(leading: pt(cuerpo.interlinea_pt) - pt(cuerpo.pt), justify: false, spacing: pt(cuerpo.interlinea_pt))
  // `raw` usaría DejaVu Sans Mono (incrustada en Typst): también Space Mono.
  show raw: set text(font: fuente-texto)
  set heading(numbering: none)
  show heading.where(level: 1): it => block(below: pt(estilos.titulo.pt) * 0.5,
    text(font: fuente-titulos, size: pt(estilos.titulo.pt), weight: "regular", fill: negro, it.body))
  show heading.where(level: 2): it => block(above: pt(estilos.subtitulo.pt), below: pt(estilos.subtitulo.pt) * 0.6,
    text(font: fuente-titulos, size: pt(estilos.subtitulo.pt), weight: "regular", fill: negro, it.body))
  doc
}

// ── Estilos de texto reutilizables (tamaños de reglas.json) ────────────
#let estilo(nombre, body) = {
  let e = estilos.at(nombre)
  let peso = if e.peso == "bold" { "bold" } else { "regular" }
  let lead = if e.at("interlinea_pt", default: none) != none { pt(e.interlinea_pt) - pt(e.pt) } else { 0.3em }
  set text(font: e.fuente, size: pt(e.pt), weight: peso)
  set par(leading: lead)
  body
}
#let pie(body) = estilo("pie", body)
#let cuerpo-2col(body) = estilo("cuerpo_2col", body)
// Texto calado: claro sobre negro sólido, Space Mono Bold ≥ 10 pt.
#let calado(body, fondo: "#000000") = {
  let e = estilos.calado
  block(fill: tinta(fondo), inset: pt(e.pt) * 0.8, radius: 2pt,
    text(font: e.fuente, size: pt(e.pt), weight: "bold", fill: blanco, body))
}
// Dos columnas como máximo (reglas.tipografia.columnas).
#let columnas-2(body) = {
  let c = reglas.tipografia.columnas
  columns(c.maximo, gutter: pt(c.separacion_pt), cuerpo-2col(body))
}

// ── Guías rotuladas (hoja de prueba): corte, sangrado, zona segura, caja ─
#let guias() = {
  let g = (
    ("corte (TrimBox)", "#e4002b", (0pt, 0pt, corte-w, corte-h)),
    ("sangrado (BleedBox)", "#ff2f92", (-pt(reglas.formato.sangrado_pt), -pt(reglas.formato.sangrado_pt),
      corte-w + 2 * pt(reglas.formato.sangrado_pt), corte-h + 2 * pt(reglas.formato.sangrado_pt))),
    ("zona segura", "#00a86b", (zona-segura, zona-segura, corte-w - 2 * zona-segura, corte-h - 2 * zona-segura)),
  )
  for (nombre, color, (x, y, w, h)) in g {
    place(top + left, dx: off + x, dy: off + y,
      rect(width: w, height: h, stroke: (paint: tinta(color), thickness: 0.5pt, dash: "dashed")))
    place(top + left, dx: off + x + 4pt, dy: off + y + 2pt,
      text(font: fuente-texto, size: pt(estilos.pie.pt), fill: tinta(color), nombre))
  }
}
// La caja de texto depende de la paridad de la página (inside/outside).
#let guia-caja(pagina) = {
  let recto = calc.odd(pagina)
  let x = if recto { pt(margen.interior_pt) } else { pt(margen.exterior_pt) }
  place(top + left, dx: off + x, dy: off + pt(margen.superior_pt),
    rect(width: caja-w, height: caja-h, stroke: (paint: tinta("#2f6bff"), thickness: 0.5pt, dash: "dotted")))
  // Rótulo justo encima de la caja (en el margen superior), para no pisar el texto.
  place(top + left, dx: off + x + 4pt, dy: off + pt(margen.superior_pt) - 10pt,
    text(font: fuente-texto, size: pt(estilos.pie.pt), fill: tinta("#2f6bff"), "caja de texto " + str(margen.caja_texto.ancho_pt) + " × " + str(margen.caja_texto.alto_pt) + " pt"))
}

// ── Escala de grises 0–100 % (paso de reglas.bn / prueba) ─────────────
#let escala-grises(paso: reglas.prueba.grises_paso_pct, ancho: 100%) = {
  let n = calc.quo(100, paso) + 1
  let celdas = ()
  for i in range(n) {
    let p = i * paso
    celdas.push(stack(dir: ttb, spacing: 2pt,
      rect(width: 100%, height: 16pt, fill: luma(100% - p * 1%), stroke: 0.25pt + negro),
      text(font: fuente-texto, size: pt(estilos.pie.pt), str(p) + " %")))
  }
  grid(columns: n, column-gutter: 1pt, ..celdas)
}
