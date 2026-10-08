// Gemelos de ImageFull, ImageSide, Gallery, Polaroid, PhotoOld, Xerox,
// BeforeAfter y OptimizedImage. Anchos de /print/componentes.json.
#import "/print/lib/componentes/util.typ": *

#let pie-foto(ctx, caption, align-: center, color: none, mayus: false) = {
  if caption == none or caption == "" { return }
  let t = if mayus { upper(caption) } else { caption }
  block(above: 4pt, width: 100%, align(align-, texto("pie", quien: "pie de foto", fill: color, t)))
}

#let image-full(ctx, p, hijos) = block(width: 100%, breakable: false, {
  imagen(ctx, p.src, width: caja * geo.image_full.ancho_pct / 100, alto-max-pct: geo.image_full.alto_max_pct)
  pie-foto(ctx, p.at("caption", default: none), align-: left)
})

/// Typst no hace que el texto rodee una figura: la foto va al lado
/// indicado, al ancho pedido, y el texto sigue debajo.
#let image-side(ctx, p, hijos) = {
  let w = p.at("width", default: str(geo.image_side.ancho_pct_default) + "%")
  let ancho = if w.ends-with("%") { caja * float(w.trim("%")) / 100 } else { float(w.trim("px")) * geo.optimized_image.px_a_pt * 1pt }
  let lado = if p.at("side", default: "left") == "right" { right } else { left }
  let ancho = ancho-ajustado(foto-de(ctx, p.src), ancho, geo.image_side.alto_max_pct)
  block(width: 100%, breakable: false, align(lado, box(width: ancho, {
    imagen(ctx, p.src, width: 100%)
    pie-foto(ctx, p.at("caption", default: none), align-: left)
  })))
}

#let gallery(ctx, p, hijos) = {
  let imgs = p.images
  let cols = calc.min(imgs.len(), geo.gallery.columnas_max)
  let celdas = ()
  for (i, im) in imgs.enumerate() {
    let g = geo.gallery.giro_grados.at(calc.rem(i, geo.gallery.giro_grados.len()))
    celdas.push(rotate(giro(g, max: 3), reflow: false, block({
      imagen(ctx, im.src, width: 100%, height: caja-h * geo.gallery.alto_max_pct / 100, fit: "contain")
      pie-foto(ctx, im.at("caption", default: none))
    })))
  }
  block(width: 100%, breakable: false, inset: (y: 4pt), grid(columns: cols, column-gutter: pt(geo.gallery.separacion_pt), row-gutter: 10pt, ..celdas))
}

#let polaroid(ctx, p, hijos) = {
  let G = geo.polaroid
  let ancho = caja * G.ancho_pct / 100
  let t = giro(p.at("tilt", default: -3), max: G.giro_grados_max)
  let ancho = ancho-ajustado(foto-de(ctx, p.src), ancho - 2 * pt(G.marco_pt), G.alto_max_pct) + 2 * pt(G.marco_pt)
  block(width: 100%, breakable: false, above: 6pt, below: 6pt, align(center, rotate(t, reflow: true,
    box(width: ancho, fill: blanco, stroke: 0.5pt + luma(80%), inset: (x: pt(G.marco_pt), top: pt(G.marco_pt), bottom: pt(G.pie_pt)), {
      imagen(ctx, p.src, width: 100%)
      pie-foto(ctx, p.at("caption", default: none), color: tinta("#333333"))
    }))))
}

#let photo-old(ctx, p, hijos) = {
  let G = geo.photo_old
  let ancho = caja * G.ancho_pct / 100
  let t = giro(p.at("tilt", default: -2), max: G.giro_grados_max)
  let ancho = ancho-ajustado(foto-de(ctx, p.src), ancho - 2 * pt(G.marco_pt), G.alto_max_pct) + 2 * pt(G.marco_pt)
  let cinta = rect(width: pt(G.cinta_pt), height: 11pt, fill: tinta("#ffffff").transparentize(50%), stroke: 0.5pt + luma(85%))
  block(width: 100%, breakable: false, inset: (y: 8pt), align(center, rotate(t, reflow: true, box(width: ancho, {
    box(width: 100%, fill: tinta("#efe4c8"), inset: pt(G.marco_pt), imagen(ctx, p.src, width: 100%))
    place(top + left, dx: -6pt, dy: -5pt, rotate(-35deg, cinta))
    place(top + right, dx: 6pt, dy: -5pt, rotate(35deg, cinta))
    pie-foto(ctx, p.at("caption", default: none), color: tinta("#443322"))
  }))))
}

/// Foto "fotocopiada": siempre la variante en gris (bn), marco y sello COPIA.
#let xerox(ctx, p, hijos) = {
  let G = geo.xerox
  let foto = foto-de(ctx, p.src)
  let ancho = ancho-ajustado(foto, caja * G.ancho_pct / 100 - 2 * pt(G.marco_pt), G.alto_max_pct) + 2 * pt(G.marco_pt)
  block(width: 100%, breakable: false, {
    box(width: ancho, stroke: pt(G.marco_pt) + negro, {
      if foto != none and foto.existe { image(foto.bn, width: 100%) } else { pendiente(ctx, foto) }
      place(bottom + right, dx: -8pt, dy: -8pt, rotate(-4deg, box(fill: white, stroke: 1.5pt + black, inset: (x: 5pt, y: 3pt),
        text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), fill: black, tracking: 0.08em, upper("Copia")))))
    })
    pie-foto(ctx, p.at("caption", default: none), mayus: true)
  })
}

#let before-after(ctx, p, hijos) = {
  let etiqueta(t) = box(fill: negro, inset: (x: 5pt, y: 2pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), fill: blanco, upper(t)))
  block(width: 100%, breakable: false, grid(columns: (1fr, 1fr), column-gutter: pt(geo.before_after.separacion_pt),
    { etiqueta(p.at("beforeLabel", default: "Antes")); v(2pt); imagen(ctx, p.before, width: 100%) },
    { etiqueta(p.at("afterLabel", default: "Después")); v(2pt); imagen(ctx, p.after, width: 100%) }))
}

#let optimized-image(ctx, p, hijos) = {
  let w = calc.min(caja, float(p.at("width", default: geo.mascota.ancho_pt_default)) * geo.optimized_image.px_a_pt * 1pt)
  block(width: 100%, breakable: false, align(center, imagen(ctx, p.src, width: w, alto-max-pct: geo.optimized_image.alto_max_pct)))
}
