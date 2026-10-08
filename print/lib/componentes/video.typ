// Gemelo de VideoPoster / VideoOldTV / VideoCinema: en papel no hay
// video; sale un QR vectorial de ≥ 0.6 in con zona de silencio y la
// leyenda "▶ Video: <título> — escanéalo" (pie, 7.5 pt). El export ya
// resolvió `url` y `qr`; con impreso.multimedia = "omitir" el nodo no llega.
#import "/print/lib/componentes/util.typ": *

#let video-poster(ctx, p, hijos) = {
  let G = geo.video
  let kind = p.at("kind", default: "video")
  let prefijo = if kind == "playlist" { G.playlist_prefijo } else { G.leyenda_prefijo }
  let meta = p.at("meta", default: none)
  block(width: 100%, breakable: false, above: 8pt, below: 8pt, stroke: (paint: negro, thickness: 0.75pt, dash: "dashed"), inset: 8pt,
    grid(columns: (auto, 1fr), column-gutter: 10pt, align: horizon,
      qr(ctx, p.qr, lado: inch(G.qr_in)),
      texto("pie", quien: "VideoPoster", {
        play(fill: negro)
        h(4pt)
        [#prefijo: #strong(p.title) — #G.leyenda_sufijo]
        if meta != none { linebreak(); meta }
      })))
}
