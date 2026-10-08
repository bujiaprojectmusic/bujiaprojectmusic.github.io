// Gemelos de Columnas, Quote, Note y Divider.
#import "/print/lib/componentes/util.typ": *

/// Columnas: máximo 2 en papel (las 3 de la web se imprimen en 2), cuerpo_2col.
#let columnas(ctx, p, hijos) = {
  let c = reglas.tipografia.columnas
  let n = calc.min(int(p.at("n", default: 2)), c.maximo)
  block(width: 100%, columns(n, gutter: pt(c.separacion_pt), texto("cuerpo_2col", quien: "Columnas", (ctx.render)(ctx, hijos))))
}

#let quote(ctx, p, hijos) = {
  let c = colores(ctx)
  let cita = p.at("cite", default: none)
  block(width: 100%, breakable: false, above: 10pt, below: 10pt, inset: (left: 12pt, y: 4pt, right: 6pt), stroke: (left: 2.25pt + negro), {
    place(top + left, dx: -4pt, dy: -10pt, text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 0.625, fill: c.accent, stroke: 0.6pt + negro, "“"))
    texto("cuerpo_2col", quien: "Quote", peso: "bold", fill: negro, upper((ctx.render)(ctx, hijos)))
    if cita != none { v(2pt); texto("pie", quien: "Quote cite")[— #cita] }
  })
}

#let note(ctx, p, hijos) = {
  let c = colores(ctx)
  let variante = p.at("variant", default: "note")
  let titulos = (note: "Nota", warning: "Ojo", tip: "Tip")
  let etiqueta = p.at("title", default: titulos.at(variante, default: "Nota"))
  let (bg, fg, borde) = if variante == "warning" { (tinta("#e63d2f"), blanco, tinta("#e63d2f")) } else if variante == "tip" { (c.accent, c.ink, negro) } else { (negro, blanco, negro) }
  // `pt` sólo para pruebas: un tamaño bajo el mínimo hace panic (reglas).
  let tam = p.at("pt", default: none)
  block(width: 100%, breakable: false, above: 8pt, below: 8pt, fill: blanco, stroke: 1.5pt + borde, radius: 3pt, inset: 10pt, {
    box(fill: bg, radius: 99pt, inset: (x: 7pt, y: 2.5pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), fill: fg, tracking: 0.05em, upper(etiqueta)))
    v(4pt)
    texto("cuerpo_2col", tamano: tam, quien: "Note", (ctx.render)(ctx, hijos))
  })
}

#let divider(ctx, p, hijos) = {
  let c = colores(ctx)
  let variante = p.at("variant", default: "zigzag")
  let cuerpo = if variante == "dashed" {
    line(length: 100%, stroke: (paint: negro, thickness: 2.25pt, dash: "dashed"))
  } else if variante == "stars" {
    align(center, texto("cuerpo_2col", quien: "Divider stars", fill: c.accent, text(tracking: 1em, "* * *")))
  } else if variante == "tape" {
    align(center, rotate(-2deg, rect(width: 68pt, height: 12pt, fill: c.accent)))
  } else {
    // zigzag: triángulos repetidos
    let n = int(caja / 10.5pt)
    let tri = polygon(fill: negro, (0pt, 9pt), (5.25pt, 0pt), (10.5pt, 9pt))
    box(width: 100%, height: 9pt, clip: true, grid(columns: n, ..range(n).map(_ => tri)))
  }
  block(width: 100%, above: 12pt, below: 12pt, cuerpo)
}
