// Páginas del volumen: portada, índice, piezas, relleno, Fin y
// contraportada. Cada pliego es UNA página (page(...)[…]); al principio y
// al final lleva metadata con su número de página real: check.mjs la lee
// con `typst query` y falla el build si un pliego desborda.
#import "/print/lib/componentes/util.typ": *
#import "/print/lib/render.typ": contexto, render-nodos

#let marca-prueba(vol) = {
  if not vol.prueba { return none }
  place(bottom + center, dy: -(off + pt(reglas.folio.linea_base_desde_corte_inferior_pt)) + 10pt,
    box(fill: negro, inset: (x: 5pt, y: 2pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.folio.pt), fill: blanco, tracking: 0.06em, upper("Edición de prueba — contenido ficticio"))))
}

/// Con `--input marcas-prueba=true` cada página lleva "P01"…"PN" dentro de
/// la caja de texto: check.mjs lee las mitades de cada cara del
/// cuadernillo con pdftotext y compara con la tabla de imposición (#10).
#let marcas-prueba = sys.inputs.at("marcas-prueba", default: "false") == "true"
#let marca-prueba-pagina(n) = {
  if not marcas-prueba { return none }
  let id = "P" + (if n < 10 { "0" + str(n) } else { str(n) })
  place(top + left, box(fill: blanco, stroke: 0.5pt + negro, inset: 3pt, text(font: fuente-texto, weight: "bold", size: pt(estilos.calado.pt), fill: negro, id)))
}

/// Metadatos de inicio/fin del pliego (página real) para check.mjs.
#let marca-inicio(n) = [#context [#metadata((tipo: "inicio", n: n, pagina: here().page()))#label("pliego-" + str(n))]#marca-prueba-pagina(n)]
#let marca-fin(n) = context [#metadata((tipo: "fin", n: n, pagina: here().page()))]

/// Página con fondo opcional a sangre (`fondo`: contenido que cubre el
/// BleedBox) y texto en `fill`.
#let pagina(vol, n, cuerpo, fondo: none, fill: none, margen-cero: false) = {
  let extra = if fondo != none { p => fondo-sangre(fondo) } else { none }
  page(
    background: fondo-pagina(paginas: vol.paginas, extra: extra),
    foreground: marca-prueba(vol),
    ..(if margen-cero { (margin: (top: off, bottom: off, inside: off, outside: off)) } else { (:) }),
  )[
    #set text(fill: fill) if fill != none
    #marca-inicio(n)
    #cuerpo
    #marca-fin(n)
  ]
}

#let nodo(pliego, nombre) = pliego.nodos.find(x => x.t == "componente" and x.nombre == nombre)

// ── Portada (pág. 1): foto a sangre oscurecida, Vol. NN, título, mes,
//    parche y mascota. ───────────────────────────────────────────────────
#let portada(vol, pliego) = {
  let ctx = contexto(vol, 1, vol.esquema)
  let c = colores(ctx)
  let P = nodo(pliego, "Portada")
  let p = if P != none { P.props } else { (:) }
  let G = geo.portada
  let foto = p.at("image", default: none)
  // En B/N (fotocopia) la página se aclara: fondo papel, foto velada en
  // blanco y texto negro (reglas.bn: nada de negro sólido a toda página).
  let base = if es-bn { blanco } else { c.ink }
  let fondo = {
    rect(width: 100%, height: 100%, fill: base)
    if foto != none and foto-de(ctx, foto).existe {
      place(top + left, box(width: 100%, height: 100%, clip: true, imagen(ctx, foto, width: 100%, height: 100%, fit: "cover")))
      place(top + left, rect(width: 100%, height: 100%, fill: base.transparentize(G.opacidad_foto * 100%)))
    }
  }
  let cuerpo = {
    // Resto de nodos del pliego (texto extra de portada), arriba.
    render-nodos(ctx, pliego.nodos.filter(x => not (x.t == "componente" and x.nombre == "Portada")))
    place(top + right, dx: 0pt, dy: 0pt, imagen(ctx, vol.mascota, width: pt(G.mascota_ancho_pt)))
    place(bottom + left, {
      let tinta-texto = if es-bn { negro } else { c.paper }
      box(fill: c.accent, inset: (x: 6pt, y: 3pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.folio.pt), fill: c.ink, tracking: 0.15em, upper("Volumen " + vol-nn(p.at("volume", default: vol.volumen)))))
      v(6pt)
      block(width: 100%, text(font: fuente-titulos, size: pt(estilos.titulo.pt_max), fill: tinta-texto, hyphenate: false, upper(p.at("title", default: vol.titulo))))
      v(4pt)
      texto("cuerpo_1col", quien: "Portada subtitle", fill: tinta-texto, {
        let s = p.at("subtitle", default: none)
        if s != none { s } else { mes-anio(vol.fecha) }
      })
      v(6pt)
      // Parche: sello con el mes y la web.
      rotate(-3deg, reflow: true, box(stroke: 1.5pt + c.accent, inset: (x: 6pt, y: 3pt),
        text(font: fuente-texto, weight: "bold", size: pt(estilos.pie.pt), fill: c.accent, tracking: 0.08em, upper(mes-anio(vol.fecha) + " · " + vol.sitio.replace("https://", "")))))
    })
  }
  pagina(vol, 1, cuerpo, fondo: fondo, fill: if es-bn { negro } else { c.paper })
}

// ── Índice (pág. 2): número de página REAL de cada pieza (desde el
//    marcador <pliego-N>), sin ligas en imprenta, con ligas en pantalla. ─
#let indice(vol, pliego) = {
  let ctx = contexto(vol, 2, vol.esquema)
  let c = colores(ctx)
  let I = nodo(pliego, "Indice")
  let items = if I != none { I.props.items } else { () }
  let fila(it) = {
    let lbl = label("pliego-" + str(it.page))
    let real = context { counter(page).at(lbl).first() }
    let num = box(fill: c.accent, inset: (x: 4pt, y: 2pt), text(font: fuente-texto, weight: "bold", size: pt(estilos.indice.pt), fill: c.ink, context {
      let r = counter(page).at(lbl).first()
      if r < 10 { "0" + str(r) } else { str(r) }
    }))
    let t = texto("indice", quien: "Indice", it.title)
    let contenido = grid(columns: (auto, 1fr, auto), column-gutter: 6pt, align: bottom, t, box(width: 100%, baseline: -2pt, line(length: 100%, stroke: (paint: negro, thickness: 1pt, dash: "dotted"))), num)
    if ctx.pantalla { link(lbl, contenido) } else { contenido }
  }
  let cuerpo = {
    block(below: 12pt, text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 0.8, upper("Índice")))
    for it in items { block(width: 100%, below: 7pt, fila(it)) }
    v(8pt)
    render-nodos(ctx, pliego.nodos.filter(x => not (x.t == "componente" and x.nombre == "Indice")))
  }
  pagina(vol, 2, cuerpo)
}

// ── Pieza (3 … N-2) ──────────────────────────────────────────────────────
// Con `bleed="/img/…"` la foto cubre la página (hasta el BleedBox), se
// oscurece con un degradado (más abajo, donde va el texto) y el texto va
// en el color papel del esquema: página de apertura tipo revista. Con
// `bleed={true}` el fondo es el ink del esquema.
#let pieza(vol, pliego) = {
  let ctx = contexto(vol, pliego.n, pliego.esquema)
  let c = colores(ctx)
  let G = geo.pliego_sangre
  let bleed = pliego.at("bleed", default: none)
  let color = pliego.at("bleed_color", default: false)
  // En B/N la foto se vela en blanco y el texto va en negro (fotocopia).
  let base = if es-bn { blanco } else { c.ink }
  let fondo = if bleed != none {
    {
      rect(width: 100%, height: 100%, fill: base)
      place(top + left, box(width: 100%, height: 100%, clip: true, imagen(ctx, bleed, width: 100%, height: 100%, fit: "cover")))
      place(top + left, rect(width: 100%, height: 100%, fill: gradient.linear(angle: 90deg,
        (base.transparentize(100% - G.oscurecer_arriba_pct * 1%), 0%),
        (base.transparentize(100% - G.oscurecer_abajo_pct * 1%), 100%))))
    }
  } else if color { rect(width: 100%, height: 100%, fill: base) } else { none }
  let fill = if bleed != none or color { if es-bn { negro } else { c.paper } } else { none }
  let cuerpo = texto("cuerpo_1col", quien: "pieza pág. " + str(pliego.n), render-nodos(ctx, pliego.nodos))
  // Sobre una foto el texto va abajo, donde el degradado oscurece más.
  pagina(vol, pliego.n, if bleed != none { v(1fr); cuerpo } else { cuerpo }, fondo: fondo, fill: fill)
}

// ── Relleno diseñado: colabora / notas / taller ──────────────────────────
#let relleno(vol, pliego) = {
  let ctx = contexto(vol, pliego.n, vol.esquema)
  let c = colores(ctx)
  let G = geo.relleno
  let tipo = pliego.at("relleno", default: "notas")
  let titulo(t) = block(below: 10pt, rotate(-2deg, reflow: true, box(fill: c.accent, inset: (x: 10pt, y: 5pt), text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 0.7, fill: c.ink, upper(t)))))
  let cuerpo = if tipo == "colabora" {
    titulo("Colabora")
    texto("cuerpo_1col", quien: "relleno colabora")[
      La Jirafa Eléctrica se arma con lo que la gente manda: fotos de su instrumento, crónicas de tocadas, tutoriales, dibujos, quejas. No hace falta escribir bonito; hace falta tener algo que contar.

      Mandalo al taller (WhatsApp #ctx.vol.taller.whatsapp) o dejalo en persona en #ctx.vol.taller.direccion. Todo se publica con crédito y con permiso.
    ]
    v(10pt)
    align(center, { qr(ctx, vol.qr_colabora, lado: inch(geo.contraportada.qr_in)); v(2pt); texto("pie", quien: "relleno colabora", vol.sitio.replace("https://", "") + G.colabora_url) })
  } else if tipo == "taller" {
    titulo("El taller")
    texto("cuerpo_1col", quien: "relleno taller", {
      strong(ctx.vol.taller.servicios.titulo); linebreak(); ctx.vol.taller.servicios.subtitulo
      parbreak()
      for a in ctx.vol.taller.anuncios { [• #a]; linebreak() }
      parbreak()
      ctx.vol.taller.direccion; linebreak()
      for h in ctx.vol.taller.horario { [#h.dias: #h.texto]; linebreak() }
      [WhatsApp #ctx.vol.taller.whatsapp · #ctx.vol.taller.web]
    })
    v(10pt)
    align(center, { imagen(ctx, vol.logo, width: pt(geo.contraportada.logo_ancho_pt)); v(6pt); qr(ctx, vol.qr_volumen, lado: inch(geo.contraportada.qr_in)) })
  } else {
    titulo("Notas")
    texto("pie", quien: "relleno notas")[Dibuja aquí. Esta página es tuya.]
    v(6pt)
    let paso = pt(G.notas_renglones_pt)
    let n = int((caja-h - 110pt) / paso)
    stack(dir: ttb, spacing: 0pt, ..range(n).map(_ => box(width: 100%, height: paso, stroke: (bottom: 0.5pt + luma(60%)))))
  }
  pagina(vol, pliego.n, cuerpo)
}

// ── Fin (pág. N-1): FIN grande, créditos, colofón, próximo volumen,
//    llamado a colaborar. Si el MDX trae contenido, va ese + colofón. ─────
#let fin(vol, pliego) = {
  let ctx = contexto(vol, pliego.n, vol.esquema)
  let c = colores(ctx)
  let C = vol.creditos
  let colofon = texto("pie", quien: "Fin colofón")[
    Impreso en Texcoco, MX. Tipografías Anton y Space Mono (SIL Open Font License). #vol.url.replace("https://", "")
  ]
  let cuerpo = if pliego.nodos.len() > 0 {
    texto("cuerpo_1col", quien: "Fin", render-nodos(ctx, pliego.nodos))
    v(1fr)
    colofon
  } else {
    align(center, text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 1.6, fill: c.accent, stroke: 1pt + negro, upper("Fin")))
    v(10pt)
    texto("cuerpo_2col", quien: "Fin créditos", {
      strong("Créditos.")
      let piezas = C.at("piezas", default: ())
      if piezas.len() > 0 { [ #piezas.join(" · ").] } else { [ Textos: #C.autor.] }
      if C.fotografos.len() > 0 { [ Fotos: #C.fotografos.join(", ").] }
      [ #C.mascota.]
      parbreak()
      [Próximo volumen: Vol. #vol-nn(vol.volumen + 1).]
      parbreak()
      [¿Querés colaborar? Fotos, crónicas, tutoriales, dibujos: mandalos al taller (WhatsApp #ctx.vol.taller.whatsapp) o vení a #ctx.vol.taller.direccion.]
    })
    v(1fr)
    align(center, imagen(ctx, vol.mascota, width: pt(geo.fin.mascota_ancho_pt)))
    v(6pt)
    colofon
  }
  pagina(vol, pliego.n, cuerpo)
}

// ── Contraportada (pág. N): fondo ink a sangre, sello, datos del taller,
//    mascota con su crédito y QR al volumen. ─────────────────────────────
#let contraportada(vol, pliego) = {
  let ctx = contexto(vol, pliego.n, vol.esquema)
  let c = colores(ctx)
  let CP = nodo(pliego, "Contraportada")
  let stamp = if CP != none { CP.props.at("texto", default: "Bujía Project Music — Texcoco, MX") } else { "Bujía Project Music — Texcoco, MX" }
  let tiene-datos = nodo(pliego, "DatosTaller") != none
  let fondo = rect(width: 100%, height: 100%, fill: if es-bn { blanco } else { c.ink })
  let tinta-texto = if es-bn { negro } else { c.paper }
  let cuerpo = {
    v(10pt)
    align(center, rotate(-3deg, reflow: true, box(stroke: 2.25pt + c.accent, inset: (x: 12pt, y: 8pt),
      text(font: fuente-texto, weight: "bold", size: pt(estilos.indice.pt), fill: tinta-texto, tracking: 0.08em, upper(stamp)))))
    v(10pt)
    render-nodos(ctx, pliego.nodos.filter(x => not (x.t == "componente" and x.nombre == "Contraportada")))
    v(1fr)
    align(center, {
      imagen(ctx, vol.mascota, width: pt(geo.contraportada.mascota_ancho_pt))
      v(3pt)
      texto("pie", quien: "Contraportada", fill: tinta-texto, geo.mascota.credito)
      if not tiene-datos { v(6pt); qr(ctx, vol.qr_volumen, lado: inch(geo.contraportada.qr_in)); v(2pt); texto("pie", quien: "Contraportada", fill: tinta-texto, vol.url.replace("https://", "")) }
    })
  }
  pagina(vol, pliego.n, cuerpo, fondo: fondo, fill: tinta-texto)
}

#let render-volumen(vol) = {
  for pliego in vol.pliegos {
    let t = pliego.tipo
    if t == "portada" { portada(vol, pliego) }
    else if t == "indice" { indice(vol, pliego) }
    else if t == "fin" { fin(vol, pliego) }
    else if t == "contraportada" { contraportada(vol, pliego) }
    else if t == "relleno" { relleno(vol, pliego) }
    else { pieza(vol, pliego) }
  }
}
