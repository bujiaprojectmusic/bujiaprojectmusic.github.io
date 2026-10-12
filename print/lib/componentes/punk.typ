// Gemelos de los componentes nuevos del vol. 01 (issue #17, parte b):
// CintaCanela, SelloGoma, TituloRescate y CollageXerox. Planos y aptos
// para tinta: polígonos, tiling y recortes; nada de transparencias para
// leerse. Geometría en /print/componentes.json (cinta_canela, sello_goma,
// titulo_rescate, collage_xerox): la web lee los mismos valores.
#import "/print/lib/componentes/util.typ": *

#let px(v) = float(v) * geo.optimized_image.px_a_pt * 1pt

// ── CintaCanela: polígono con extremos rasgados + trama de tela ─────────
#let tira-canela(w) = {
  let G = geo.cinta_canela
  let h = w * G.alto_pct / 100
  let paso = pt(G.trama_paso_pt)
  let tela = tiling(size: (paso, paso), {
    place(rect(width: paso, height: paso, fill: tinta(G.color)))
    place(line(start: (0pt, paso), end: (paso, paso), stroke: 0.3pt + tinta(G.trama)))
    place(line(start: (paso, 0pt), end: (paso, paso), stroke: 0.3pt + tinta(G.trama)))
  })
  let puntos = G.puntos_pct.map(((x, y)) => (w * x / 100, h * y / 100))
  box(width: w, height: h, polygon(fill: tela, stroke: 0.4pt + tinta(G.borde), ..puntos))
}

#let cinta-canela(ctx, p, hijos) = {
  let G = geo.cinta_canela
  let w = px(p.at("largo", default: G.largo_px_default))
  let a = giro(p.at("angulo", default: -4), max: G.giro_grados_max)
  let pos = p.at("pos", default: none)
  let tira = tira-canela(w)
  if pos == none { align(center, box(rotate(a, reflow: true, tira))) }
  else if pos == "arriba" { place(top + center, dy: -w * G.alto_pct / 200, rotate(a, tira)) }
  else if pos == "abajo" { place(bottom + center, dy: w * G.alto_pct / 200, rotate(a, tira)) }
  else if pos == "izquierda" { place(top + left, dx: -w * 0.3, rotate(a - 35deg, tira)) }
  else { place(top + right, dx: w * 0.3, rotate(a + 35deg, tira)) }
}

// ── SelloGoma: doble borde, giro, tinta irregular (puntos color papel) ──
#let sello-goma(ctx, p, hijos) = {
  let G = geo.sello_goma
  let c = colores(ctx)
  let nombre = p.at("color", default: "rojo")
  let col = if nombre == "ink" { c.ink } else if nombre == "accent" { c.accent } else { tinta(G.colores.at(nombre, default: G.colores.rojo)) }
  let a = giro(p.at("angulo", default: G.giro_grados_default), max: G.giro_grados_max)
  let sello = box(stroke: pt(G.borde_ext_pt) + col, inset: pt(G.separacion_pt),
    box(stroke: pt(G.borde_int_pt) + col, inset: (x: 8pt, y: 4pt),
      text(font: fuente-texto, weight: "bold", size: pt(estilos.calado.pt), fill: col, tracking: 0.12em, upper(p.texto))))
  // Fallas de tinta: puntos del color del papel encima del sello.
  let paso = pt(G.fallas_paso_pt)
  let fallas = tiling(size: (paso, paso), place(center + horizon, circle(radius: pt(G.fallas_punto_pt), fill: c.paper)))
  let con-fallas = context {
    let m = measure(sello)
    box(width: m.width, height: m.height, { place(sello); place(rect(width: m.width, height: m.height, fill: fallas)) })
  }
  box(inset: (x: 6pt, y: 4pt), rotate(a, reflow: true, con-fallas))
}

// ── TituloRescate: recortes por letra (en B/N el estilo 3 va en negro:
//    el accent en gris claro no se lee sobre papel) (props.letras los calcula el export
//    con src/utils/rescate.ts: misma semilla, mismo resultado que la web) ─
#let titulo-rescate(ctx, p, hijos) = {
  let G = geo.titulo_rescate
  let c = colores(ctx)
  let base = pt(G.tamano_pt)
  let recorte(l) = {
    let (bg, fg, st) = if l.estilo == 1 { (c.ink, c.paper, 1pt + c.ink) } else if l.estilo == 2 { (c.accent, c.ink, 1pt + c.ink) } else if l.estilo == 3 { (c.paper, if es-bn { negro } else { c.accent }, (paint: c.ink, thickness: 1pt, dash: "dashed")) } else { (c.paper, c.ink, 1pt + c.ink) }
    let fuente = if l.fuente == "mono" { fuente-texto } else { fuente-titulos }
    let peso = if l.fuente == "mono" { "bold" } else { "regular" }
    box(rotate(l.giro * 1deg, reflow: true, box(fill: bg, stroke: st, inset: (x: pt(G.inset_x_pt), y: pt(G.inset_y_pt)),
      text(font: fuente, weight: peso, size: base * l.escala, fill: fg, upper(l.c)))))
  }
  let letras = p.at("letras", default: ())
  block(width: 100%, above: 10pt, below: 8pt, breakable: false,
    heading(level: 1, outlined: false, bookmarked: ctx.pantalla, {
      set par(leading: pt(G.interlinea_pt))
      for l in letras {
        if l.at("espacio", default: false) { h(pt(G.espacio_pt)) } else { recorte(l); h(1.5pt) }
      }
    }))
}

// ── CollageXerox: fotos en gris encimadas con cinta canela ───────────────
#let collage-xerox(ctx, p, hijos) = {
  let G = geo.collage_xerox
  let c = colores(ctx)
  let alto = caja-h * G.alto_pct / 100
  let fotos = p.images
  block(width: 100%, breakable: false, {
    box(width: 100%, height: alto, clip: true, stroke: 2.25pt + negro, fill: c.paper, {
      for (i, im) in fotos.enumerate() {
        let (x, y, w) = G.posiciones_pct.at(i)
        let ancho = caja * w / 100
        let foto = foto-de(ctx, im.src)
        place(top + left, dx: caja * x / 100, dy: alto * y / 100, rotate(G.giros.at(i) * 1deg, {
          box(fill: blanco, inset: pt(G.marco_pt), stroke: 0.5pt + luma(70%), {
            if foto != none and foto.existe { image(if ctx.variante == "imprenta" { foto.at("bn_imprenta", default: foto.bn) } else { foto.bn }, width: ancho - 2 * pt(G.marco_pt)) } else { pendiente(ctx, foto, width: ancho) }
          })
          place(top + center, dy: -4pt, rotate(if calc.odd(i) { 5deg } else { -6deg }, tira-canela(pt(G.cinta_pt))))
        }))
      }
    })
    let cap = p.at("caption", default: none)
    if cap != none { block(above: 4pt, width: 100%, align(center, texto("pie", quien: "CollageXerox", upper(cap)))) }
  })
}
