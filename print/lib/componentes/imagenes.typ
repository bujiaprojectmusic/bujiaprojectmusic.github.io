// Gemelos de ImageFull, ImageSide, Gallery, Polaroid, PhotoOld, Xerox,
// BeforeAfter y OptimizedImage. Anchos de /print/componentes.json.
#import "/print/lib/componentes/util.typ": *
#import "/print/vendor/wrap-it-0.1.1/wrap-it.typ": wrap-content

#let pie-foto(ctx, caption, align-: center, color: none, mayus: false) = {
  if caption == none or caption == "" { return }
  let t = if mayus { upper(caption) } else { caption }
  block(above: 4pt, width: 100%, align(align-, texto("pie", quien: "pie de foto", fill: color, t)))
}

#let image-full(ctx, p, hijos) = block(width: 100%, breakable: false, {
  imagen(ctx, p.src, width: caja * geo.image_full.ancho_pct / 100, alto-max-pct: geo.image_full.alto_max_pct)
  pie-foto(ctx, p.at("caption", default: none), align-: left)
})

/// Foto a un lado con el texto que sigue rodeándola, como en la web
/// (wrap-it, vendorizado en /print/vendor). `resto` son los nodos de
/// texto corrido que vienen después en el MDX (los junta render.typ);
/// sin resto, la foto va sola al lado pedido.
#let image-side(ctx, p, hijos, resto: ()) = {
  let w = p.at("width", default: str(geo.image_side.ancho_pct_default) + "%")
  let ancho = if w.ends-with("%") { caja * float(w.trim("%")) / 100 } else { float(w.trim("px")) * geo.optimized_image.px_a_pt * 1pt }
  let derecha = p.at("side", default: "left") == "right"
  let ancho = ancho-ajustado(foto-de(ctx, p.src), ancho, geo.image_side.alto_max_pct)
  let figura = box(width: ancho, inset: (bottom: 4pt), {
    imagen(ctx, p.src, width: 100%)
    pie-foto(ctx, p.at("caption", default: none), align-: left)
  })
  if resto.len() == 0 {
    return block(width: 100%, breakable: false, align(if derecha { right } else { left }, figura))
  }
  block(width: 100%, wrap-content(figura, (ctx.render)(ctx, resto), align: top + (if derecha { right } else { left }), column-gutter: pt(geo.image_side.separacion_pt)))
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
      if foto != none and foto.existe { image(if ctx.variante == "imprenta" { foto.at("bn_imprenta", default: foto.bn) } else { foto.bn }, width: 100%) } else { pendiente(ctx, foto) }
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

// ── Fotos editoriales de una pieza ───────────────────────────────────────
/// <Foto foto ancho="completo|columna|mitad" />: foto entre los párrafos.
/// completo = caja entera, columna = 66 %, mitad = media caja (dos seguidas
/// van en pareja: render.typ llama fotos-mitad). Pie de 7.5 pt (reglas.json).
#let foto(ctx, p, hijos) = {
  let G = geo.foto
  let ancho = p.at("ancho", default: "completo")
  let wmax = if ancho == "columna" { caja * G.columna_pct / 100 } else if ancho == "mitad" { (caja - pt(G.mitad_separacion_pt)) / 2 } else { caja }
  let w = ancho-ajustado(foto-de(ctx, p.src), wmax, G.alto_max_pct)
  block(width: 100%, breakable: false, above: 8pt, below: 8pt, align(if ancho == "mitad" { left } else { center }, box(width: w, {
    imagen(ctx, p.src, width: 100%)
    pie-foto(ctx, p.at("caption", default: none), align-: left)
  })))
}

/// Dos <Foto ancho="mitad"> seguidas, una al lado de la otra.
#let fotos-mitad(ctx, a, b) = {
  let G = geo.foto
  let w = (caja - pt(G.mitad_separacion_pt)) / 2
  let celda(p) = {
    let wi = ancho-ajustado(foto-de(ctx, p.src), w, G.alto_max_pct)
    box(width: wi, { imagen(ctx, p.src, width: 100%); pie-foto(ctx, p.at("caption", default: none), align-: left) })
  }
  block(width: 100%, breakable: false, above: 8pt, below: 8pt,
    grid(columns: (1fr, 1fr), column-gutter: pt(G.mitad_separacion_pt), align: top, celda(a), celda(b)))
}

/// <FotoCita foto cita autor alt pie />: cita grande sobre la foto.
/// modo "sangre": la foto es el fondo de la página entera (pieza() la pone a
/// sangre con el degradado y manda el texto abajo); acá sólo va la cita.
/// modo "marco" (foto sin resolución para ir a sangre: el export lo decide
/// con reglas.imagenes.ppi_error_menor_a): la foto va dentro de la caja al
/// ancho que aguanta, con la cita encima sobre un degradado, sin escalarla de más.
#let foto-cita(ctx, p, hijos) = {
  let G = geo.foto_cita
  let c = colores(ctx)
  let modo = p.at("modo", default: "sangre")
  let base = if es-bn { blanco } else { c.ink }
  let claro = if es-bn { negro } else { c.paper }
  // Tamaño de la cita: titulo.pt_max × cita_factor a página completa; en el
  // modo marco baja con el ancho de la foto, nunca por debajo de titulo.minimo_pt.
  let cita(fill, factor: 1.0) = {
    let tam = calc.max(pt(estilos.titulo.minimo_pt), pt(estilos.titulo.pt_max) * G.cita_factor * factor)
    set par(leading: tam * (estilos.titulo.interlinea_factor - 1))
    text(font: fuente-titulos, size: tam * G.comilla_factor / G.cita_factor, fill: c.accent, stroke: 0.6pt + negro, "“")
    linebreak()
    text(font: fuente-titulos, size: tam, fill: fill, hyphenate: false, upper(p.cita))
    let autor = p.at("autor", default: none)
    if autor != none { linebreak(); v(3pt); text(font: fuente-texto, weight: "bold", size: pt(estilos.cuerpo_2col.pt), fill: fill, "— " + autor) }
  }
  let pie = p.at("caption", default: none)
  if modo == "sangre" {
    block(width: 100%, breakable: false, {
      cita(claro)
      if pie != none { v(8pt); texto("pie", quien: "FotoCita", fill: claro, pie) }
    })
  } else {
    let f = foto-de(ctx, p.src)
    let w = calc.min(caja, float(p.at("ancho_pt", default: caja / 1pt)) * 1pt)
    let h = if f != none and f.existe and f.ancho_px > 0 { w * f.alto_px / f.ancho_px } else { w * 3 / 4 }
    let hmax = caja-h * G.marco_alto_max_pct / 100
    let (w, h) = if h > hmax { (w * (hmax / h), hmax) } else { (w, h) }
    block(width: 100%, breakable: false, above: 8pt, below: 8pt, align(center, box(width: w, {
      box(width: 100%, height: h, clip: true, {
        place(top + left, imagen(ctx, p.src, width: 100%, height: 100%, fit: "cover"))
        place(top + left, rect(width: 100%, height: 100%, fill: gradient.linear(angle: 90deg, (base.transparentize(100%), 0%), (base.transparentize(100% - G.oscurecer_pct * 1%), 100%))))
        place(bottom + left, dx: pt(G.inset_pt), dy: -pt(G.inset_pt), box(width: w - 2 * pt(G.inset_pt), cita(claro, factor: w / caja)))
      })
      pie-foto(ctx, pie, align-: left)
    })))
  }
}
