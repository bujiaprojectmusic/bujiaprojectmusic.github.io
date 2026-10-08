// Gemelos de los nodos Markdown y de las etiquetas HTML genéricas.
#import "/print/lib/componentes/util.typ": *

/// Liga: interna → "(pág. N)" (y en pantalla, link al pliego); externa → sólo el texto.
#let liga(ctx, nodo) = {
  let cuerpo = (ctx.inline)(ctx, nodo.hijos)
  if nodo.destino.tipo == "ref" {
    let p = nodo.destino.pagina
    let t = [#cuerpo (pág. #p)]
    if ctx.pantalla { link(label("pliego-" + str(p)), t) } else { t }
  } else { cuerpo }
}

#let cita-md(ctx, nodo) = block(inset: (left: 10pt, y: 2pt), stroke: (left: 2.25pt + negro), width: 100%, (ctx.render)(ctx, nodo.hijos))

#let separador-md() = block(above: 8pt, below: 8pt, line(length: 100%, stroke: (paint: negro, thickness: 1.5pt, dash: "dashed")))

#let lista-md(ctx, nodo) = {
  let items = nodo.items.map(it => (ctx.render)(ctx, it))
  if nodo.ordenada { enum(start: nodo.inicio, tight: true, spacing: 4pt, ..items) } else { list(tight: true, spacing: 4pt, marker: text(weight: "bold")[•], ..items) }
}

/// <p>/<div>/<span>/<ul>… con clases del sitio (fz-small, fz-fin-word, fz-mascota, fz-contra-datos).
#let html(ctx, nodo) = {
  let clase = nodo.clase
  let et = nodo.etiqueta
  if et in ("strong", "b") { return strong((ctx.inline)(ctx, nodo.hijos)) }
  if et in ("em", "i") { return emph((ctx.inline)(ctx, nodo.hijos)) }
  if et == "span" { return (ctx.inline)(ctx, nodo.hijos) }
  if et in ("ul", "ol") {
    let items = nodo.hijos.filter(h => h.t == "html" and h.etiqueta == "li").map(li => (ctx.render)(ctx, li.hijos))
    return if et == "ol" { enum(tight: true, ..items) } else { list(tight: true, marker: text(weight: "bold")[•], ..items) }
  }
  if et == "li" { return (ctx.render)(ctx, nodo.hijos) }
  if et == "blockquote" { return cita-md(ctx, nodo) }
  if et == "figcaption" or et == "small" or clase.contains("fz-small") {
    return block(width: 100%, texto("pie", quien: "<" + et + " class=\"" + clase + "\">", (ctx.inline)(ctx, nodo.hijos)))
  }
  if clase.contains("fz-fin-word") {
    let c = colores(ctx)
    return align(center, block(below: 8pt, text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 1.5, fill: c.accent, stroke: 1pt + negro, upper((ctx.inline)(ctx, nodo.hijos)))))
  }
  if clase.contains("fz-mascota") or clase.contains("fz-contra-datos") {
    return align(center, block(width: 100%, (ctx.render)(ctx, nodo.hijos)))
  }
  // p / div / figure genéricos
  let cuerpo = (ctx.render)(ctx, nodo.hijos)
  if et == "p" { block(width: 100%, cuerpo) } else { cuerpo }
}
