// Recorre el árbol de nodos de volumen.json y llama al gemelo que toca.
// Los componentes reciben (ctx, props, hijos); ctx.render / ctx.inline
// vuelven a entrar acá para los hijos.
#import "/print/lib/componentes/util.typ": *
#import "/print/lib/componentes/texto.typ": liga, cita-md, separador-md, lista-md, html
#import "/print/lib/componentes/imagenes.typ": image-full, image-side, gallery, polaroid, photo-old, xerox, before-after, optimized-image
#import "/print/lib/componentes/titulos.typ": section-title, post-cover
#import "/print/lib/componentes/bloques.typ": columnas, quote, note, divider
#import "/print/lib/componentes/video.typ": video-poster
#import "/print/lib/componentes/taller.typ": datos-taller

// Un gemelo por componente web (misma lista que GEMELOS en scripts/print/lib/mdx.ts).
// Portada, Indice y Contraportada viven en paginas.typ (definen la página).
#let gemelos = (
  SectionTitle: section-title,
  PostCover: post-cover,
  Columnas: columnas,
  Quote: quote,
  Note: note,
  Divider: divider,
  ImageFull: image-full,
  ImageSide: image-side,
  Gallery: gallery,
  Polaroid: polaroid,
  PhotoOld: photo-old,
  Xerox: xerox,
  BeforeAfter: before-after,
  OptimizedImage: optimized-image,
  VideoPoster: video-poster,
  DatosTaller: datos-taller,
)

#let render-nodo(ctx, n) = {
  let t = n.t
  if t == "texto" { n.v }
  else if t == "parrafo" { (ctx.inline)(ctx, n.hijos); parbreak() }
  else if t == "fuerte" { strong((ctx.inline)(ctx, n.hijos)) }
  else if t == "enfasis" { emph((ctx.inline)(ctx, n.hijos)) }
  else if t == "codigo" { raw(n.v) }
  else if t == "salto" { linebreak() }
  else if t == "liga" { liga(ctx, n) }
  else if t == "titulo" {
    // Encabezado Markdown dentro de una pieza: subtítulo (Anton 13 pt).
    block(above: 8pt, below: 4pt, text(font: fuente-titulos, size: pt(estilos.subtitulo.pt), (ctx.inline)(ctx, n.hijos)))
  }
  else if t == "lista" { lista-md(ctx, n) }
  else if t == "cita" { cita-md(ctx, n) }
  else if t == "separador" { separador-md() }
  else if t == "bloque_codigo" { raw(n.v, block: true) }
  else if t == "html" { html(ctx, n) }
  else if t == "componente" {
    if n.nombre in ("Portada", "Indice", "Contraportada") {
      // Los pinta paginas.typ al armar la página; acá no va nada.
      none
    } else if n.nombre in gemelos {
      (gemelos.at(n.nombre))(ctx, n.props, n.hijos)
    } else {
      panic("El componente <" + n.nombre + "> no tiene gemelo Typst (print/lib/render.typ), pág. " + str(ctx.n))
    }
  }
  else { panic("nodo desconocido: " + t) }
}

// Nodos de texto corrido que pueden rodear una figura (<ImageSide>).
#let fluye(n) = n.t in ("parrafo", "lista", "cita", "titulo", "separador") or (n.t == "html" and n.etiqueta == "p")

#let render-nodos(ctx, nodos) = {
  let i = 0
  while i < nodos.len() {
    let n = nodos.at(i)
    if n.t == "componente" and n.nombre == "ImageSide" {
      // La foto va a un lado y el texto que sigue la rodea (wrap-it), como en la web.
      let resto = ()
      let j = i + 1
      while j < nodos.len() and fluye(nodos.at(j)) { resto.push(nodos.at(j)); j += 1 }
      image-side(ctx, n.props, n.hijos, resto: resto)
      i = j
    } else {
      render-nodo(ctx, n)
      i += 1
    }
  }
}

/// Contexto de un pliego. `render`/`inline` apuntan a render-nodos.
#let contexto(vol, n, esquema) = (
  vol: vol,
  variante: variante,
  pantalla: variante == "pantalla",
  n: n,
  esquema: esquema,
  render: render-nodos,
  inline: render-nodos,
)
