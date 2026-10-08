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
