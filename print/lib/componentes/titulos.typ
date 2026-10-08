// Gemelos de SectionTitle (sticker) y PostCover (5 variantes).
#import "/print/lib/componentes/util.typ": *

/// Sticker tipo "Xerox Riot": fondo accent, borde irregular, giro -2°.
/// En pantalla es también marcador (bookmark) del PDF.
#let section-title(ctx, p, hijos) = {
  let c = colores(ctx, nombre: p.at("scheme", default: none))
  let cuerpo = (ctx.inline)(ctx, hijos)
  let sticker = rotate(-2deg, reflow: true, box(inset: (x: 10pt, y: 5pt), fill: c.accent,
    text(font: fuente-titulos, size: pt(estilos.titulo.pt), fill: c.ink, tracking: 0.02em, hyphenate: false, upper(cuerpo))))
  // Recorte irregular: dos cuadrados girados detrás, como calcomanía.
  block(above: 6pt, below: 10pt, width: 100%, breakable: false,
    heading(level: 1, outlined: false, bookmarked: ctx.pantalla, {
      box(sticker)
    }))
}

#let post-cover(ctx, p, hijos) = {
  let c = colores(ctx, nombre: p.at("colorScheme", default: none))
  let variante = p.at("variant", default: "sticker")
  let tag = p.at("tag", default: none)
  let sub = p.at("subtitle", default: none)
  let titulo(fill) = text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 0.7, fill: fill, hyphenate: false, upper(p.title))
  let etiqueta(fill, bg) = if tag != none { box(fill: bg, inset: (x: 6pt, y: 2pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), fill: fill, tracking: 0.08em, upper(tag))) }
  let subt(fill) = if sub != none { texto("cuerpo_2col", quien: "PostCover subtitle", fill: fill, peso: "bold", upper(sub)) }
  let interior(fill, bg) = align(center, stack(dir: ttb, spacing: 6pt, etiqueta(fill, bg), titulo(fill), subt(fill)))
  let cuerpo = if variante == "stamp" {
    rotate(-4deg, reflow: true, box(stroke: (paint: c.ink, thickness: 2pt, dash: "solid"), radius: 50%, inset: (x: 22pt, y: 14pt),
      box(stroke: 0.75pt + c.ink, radius: 50%, inset: (x: 10pt, y: 8pt), interior(c.ink, c.ink.transparentize(90%)))))
  } else if variante == "tape" {
    rotate(-1.5deg, reflow: true, box(width: 100%, fill: c.accent, inset: (x: 16pt, y: 16pt), interior(c.ink, c.ink)))
  } else if variante == "xerox" {
    box(width: 100%, stroke: 2.25pt + c.ink, inset: 14pt, interior(c.ink, c.ink))
  } else if variante == "flyer" {
    box(width: 100%, fill: c.paper, stroke: 2.25pt + c.ink, inset: 16pt, interior(c.ink, c.accent))
  } else {
    // sticker: papel punteado con borde
    box(width: 100%, fill: c.paper, stroke: 2.25pt + c.ink, radius: 4pt, inset: 16pt, interior(c.paper, c.ink))
  }
  block(width: 100%, above: 8pt, below: 12pt, breakable: false, heading(level: 1, outlined: false, bookmarked: ctx.pantalla, align(center, cuerpo)))
}
