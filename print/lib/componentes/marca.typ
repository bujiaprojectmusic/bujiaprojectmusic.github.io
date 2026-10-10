// Gemelos de los componentes de marca (issue #17): Sticker, Cinta, Parche
// y las texturas (.tx-grain / .tx-halftone / .tx-duotone, aplicadas por
// clase desde texto.typ#html). Todo vectorial y plano: tiling de Typst,
// sin filtros rasterizados ni transparencias para leerse. Medidas en
// /print/componentes.json (sticker, cinta, parche, textura).
#import "/print/lib/componentes/util.typ": *

#let px(v) = float(v) * geo.optimized_image.px_a_pt * 1pt

/// Placeholder TODO (mismo look que utils/fanzineAssets.ts): círculo
/// punteado con el nombre, o silueta punteada para la mascota.
#let placeholder-sticker(nombre, w) = {
  let s = (paint: negro, thickness: w * 0.05, dash: "dashed")
  let etiqueta = upper(nombre.replace("-", " "))
  if nombre.starts-with("mascota") {
    box(width: w, height: w * 1.6, {
      place(top + right, dx: -w * 0.1, dy: w * 0.05, circle(radius: w * 0.17, stroke: s))
      place(top + left, dx: w * 0.15, dy: w * 0.95, rect(width: w * 0.6, height: w * 0.45, radius: w * 0.15, stroke: s))
      place(bottom + center, dy: -w * 0.25, text(font: fuente-texto, size: pt(estilos.pie.pt), "TODO"))
    })
  } else {
    box(width: w, height: w, {
      place(center + horizon, circle(radius: w * 0.43, stroke: s))
      place(center + horizon, dy: -w * 0.06, text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), etiqueta))
      place(center + horizon, dy: w * 0.1, text(font: fuente-texto, size: pt(estilos.pie.pt), "TODO"))
    })
  }
}

/// <Sticker nombre ancho rotar alt />: SVG de src/assets/fanzine/ (el
/// export resuelve `archivo`; si no existe, placeholder).
#let sticker(ctx, p, hijos) = {
  let G = geo.sticker
  let w = calc.min(caja, px(p.at("ancho", default: G.ancho_px_default)))
  let archivo = p.at("archivo", default: none)
  let cuerpo = if archivo != none { image(archivo, width: w) } else { placeholder-sticker(p.nombre, w) }
  box(rotate(giro(p.at("rotar", default: 0), max: G.giro_grados_max), reflow: true, cuerpo))
}

/// Tira de cinta adhesiva plana (color papel-amarillo, trama diagonal).
#let tira-cinta(w) = {
  let G = geo.cinta
  let h = w * G.alto_pct / 100
  let trama = tiling(size: (pt(G.trama_paso_pt), pt(G.trama_paso_pt)),
    line(start: (0%, 100%), end: (100%, 0%), stroke: (paint: tinta(G.trama), thickness: 0.4pt)))
  box(width: w, height: h, fill: tinta(G.color), stroke: 0.4pt + tinta(G.borde), box(width: 100%, height: 100%, fill: trama))
}

/// <Cinta angulo ancho pos />: en el flujo, o pegada al borde del bloque
/// actual con `pos` (arriba / abajo / izquierda / derecha).
#let cinta(ctx, p, hijos) = {
  let G = geo.cinta
  let w = px(p.at("ancho", default: G.ancho_px_default))
  let a = giro(p.at("angulo", default: -4), max: G.giro_grados_max)
  let pos = p.at("pos", default: none)
  let tira = tira-cinta(w)
  if pos == none { align(center, box(rotate(a, reflow: true, tira))) }
  else if pos == "arriba" { place(top + center, dy: -w * G.alto_pct / 200, rotate(a, tira)) }
  else if pos == "abajo" { place(bottom + center, dy: w * G.alto_pct / 200, rotate(a, tira)) }
  else if pos == "izquierda" { place(top + left, dx: -w * 0.3, rotate(a - 35deg, tira)) }
  else { place(top + right, dx: w * 0.3, rotate(a + 35deg, tira)) }
}

/// <Parche variante ancho tamano />: SVG de marca si existe (`archivo`
/// resuelto en el export); si no, el logo del taller (foto `vol.logo`).
#let parche(ctx, p, hijos) = {
  let G = geo.parche
  let w = calc.min(caja, px(p.at("tamano", default: G.ancho_px_default)))
  let archivo = p.at("archivo", default: none)
  align(center, if archivo != none { image(archivo, width: w) } else { imagen(ctx, ctx.vol.logo, width: w) })
}

/// Trama de medio tono (puntos) y grano de fotocopia como tiling vectorial.
#let trama-halftone(ctx) = {
  let G = geo.textura
  let c = colores(ctx)
  let paso = pt(G.halftone_paso_pt)
  tiling(size: (paso, paso), place(center + horizon, circle(radius: pt(G.halftone_punto_pt), fill: c.ink)))
}
#let trama-grano(ctx) = {
  let G = geo.textura
  let paso = pt(G.grano_paso_pt)
  // Puntos chicos en posiciones fijas (determinista): mismo grano en cada build.
  let puntos = ((0.1, 0.2), (0.55, 0.1), (0.8, 0.45), (0.3, 0.6), (0.65, 0.8), (0.15, 0.85), (0.9, 0.9), (0.45, 0.35))
  tiling(size: (paso, paso), {
    for (x, y) in puntos { place(top + left, dx: x * paso, dy: y * paso, circle(radius: pt(G.grano_punto_pt), fill: negro)) }
  })
}

/// Texturas por clase (desde texto.typ#html): el texto va siempre sobre
/// papel liso dentro del marco texturizado (reglas.bn: nada de texto sobre
/// medio tono). `tx-duotone`: las fotos de adentro salen en gris sobre
/// marco accent (Typst no recolorea; es el equivalente plano).
#let textura(ctx, clase, cuerpo) = {
  let G = geo.textura
  let c = colores(ctx)
  let marco = pt(G.marco_pt)
  if clase.contains("tx-duotone") {
    block(width: 100%, breakable: false, fill: c.accent, inset: marco, (ctx.render)(ctx + (duotono: true), cuerpo))
  } else {
    let trama = if clase.contains("tx-grain") { trama-grano(ctx) } else { trama-halftone(ctx) }
    block(width: 100%, breakable: false, fill: trama, stroke: 1pt + negro, inset: marco,
      block(width: 100%, fill: c.paper, inset: 8pt, (ctx.render)(ctx, cuerpo)))
  }
}
