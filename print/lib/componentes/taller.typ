// Gemelo de DatosTaller (contraportada): logo, dirección, horario,
// WhatsApp y web desde src/data/taller.ts (vía el JSON), más el QR al
// volumen en la web.
#import "/print/lib/componentes/util.typ": *

#let datos-taller(ctx, p, hijos) = {
  let T = ctx.vol.taller
  let G = geo.contraportada
  block(width: 100%, breakable: false, above: 10pt, align(center, {
    imagen(ctx, ctx.vol.logo, width: pt(G.logo_ancho_pt))
    v(6pt)
    texto("pie", quien: "DatosTaller", {
      T.direccion
      linebreak()
      for h in T.horario { [#strong(h.dias + ":") #h.texto]; linebreak() }
      [WhatsApp: #T.whatsapp · #T.web]
    })
    v(6pt)
    qr(ctx, ctx.vol.qr_volumen, lado: inch(G.qr_in))
    v(2pt)
    texto("pie", quien: "DatosTaller", ctx.vol.url.replace("https://", ""))
    if hijos.len() > 0 { v(4pt); (ctx.render)(ctx, hijos) }
  }))
}

// ── Piezas punk del taller (issue #17) ───────────────────────────────────
/// <StickerTitle text />: título sticker grande (Anton sobre accent, giro -2°).
#let sticker-title(ctx, p, hijos) = {
  let c = colores(ctx)
  let G = geo.taller_titulos
  block(width: 100%, above: 8pt, below: 10pt, breakable: false,
    rotate(G.giro_grados * 1deg, reflow: true, box(fill: c.accent, inset: (x: 10pt, y: 5pt),
      text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * G.sticker_title_factor, fill: c.ink, hyphenate: false, upper(p.text)))))
}

/// <SectionLabel text />: «[TEXTO]» en Space Mono bold, color accent, línea abajo.
#let section-label(ctx, p, hijos) = {
  let c = colores(ctx)
  block(width: 100%, above: 6pt, below: 8pt, breakable: false, stroke: (bottom: 1.5pt + negro), inset: (bottom: 3pt),
    text(font: fuente-texto, weight: "bold", size: pt(estilos.calado.pt), fill: c.accent, tracking: 0.08em, "[" + upper(p.text) + "]"))
}
