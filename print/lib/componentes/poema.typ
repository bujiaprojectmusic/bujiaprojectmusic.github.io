// Gemelos del poema: título sello, cuerpo sin reflujo, verso en banda y
// créditos del pie. Medidas en /print/componentes.json (poema) y en
// reglas.json (cuerpo_1col ≥ 9 pt, titulo).
#import "/print/lib/componentes/util.typ": *

#let titulo-poema(ctx, v) = {
  let c = colores(ctx)
  let G = geo.poema
  // Ancho fijo de la caja: un `width: 100%` medido suelto se colapsa y parte el título.
  let ancho = caja * 0.92
  let sello = box(width: ancho, stroke: pt(G.borde_ext_pt) + c.ink, inset: pt(G.separacion_pt),
    box(width: 100%, stroke: pt(G.borde_int_pt) + c.ink, inset: (x: 8pt, y: 5pt),
      align(center, {
        set text(hyphenate: false)
        texto("titulo", quien: "título de poema", tamano: G.titulo_pt, fill: c.ink)[#upper(v)]
      })))
  let paso = pt(G.fallas_paso_pt)
  let fallas = tiling(size: (paso, paso), place(center + horizon, circle(radius: pt(G.fallas_punto_pt), fill: c.paper)))
  let con-fallas = context {
    let m = measure(sello)
    box(width: m.width, height: m.height, { place(sello); place(rect(width: m.width, height: m.height, fill: fallas)) })
  }
  align(center, block(width: 100%, above: 2pt, below: 10pt, breakable: false,
    rotate(G.giro_grados * 1deg, reflow: true, box(width: 94%, con-fallas))))
}

/// Versos tal cual: cada línea es un renglón, los espacios no se comen y
/// una línea en blanco abre aire de estrofa. Sin justificar.
#let cuerpo-poema(texto) = {
  let e = estilos.cuerpo_1col
  set text(font: e.fuente, size: pt(e.pt), hyphenate: false)
  set par(justify: false, leading: pt(e.interlinea_pt) - pt(e.pt), spacing: 0pt)
  let lineas = texto.split("\n")
  if lineas.len() > 0 and lineas.last() == "" { lineas = lineas.slice(0, -1) }
  let entre = pt(e.interlinea_pt) - pt(e.pt)
  for linea in lineas {
    if linea == "" {
      v(pt(e.interlinea_pt))
    } else {
      block(above: 0pt, below: entre, breakable: false, text(linea.replace(" ", "\u{00A0}")))
    }
  }
}

#let verso-destacado(ctx, p, hijos) = {
  let c = colores(ctx)
  let G = geo.poema
  let lineas = str(p.verso).split("\n")
  block(width: 100%, breakable: false, above: 8pt, below: 8pt, fill: c.ink, inset: (x: 10pt, y: 8pt),
    texto("titulo", quien: "VersoDestacado", tamano: G.verso_pt, fill: c.paper, {
      set par(justify: false)
      set text(hyphenate: false)
      for (i, linea) in lineas.enumerate() {
        if i > 0 { linebreak() }
        linea.replace(" ", "\u{00A0}")
      }
    }))
}

#let creditos-poema(ctx, n) = {
  block(width: 100%, above: 10pt, below: 2pt, inset: (top: 6pt), stroke: (top: 0.8pt + negro),
    texto("cuerpo_2col", quien: "créditos del poema", {
      set par(justify: false)
      strong(n.autora)
      linebreak()
      [Instagram: #n.instagram]
      linebreak()
      [Medium: #n.medium]
      linebreak()
      n.credito_video
    }))
}
