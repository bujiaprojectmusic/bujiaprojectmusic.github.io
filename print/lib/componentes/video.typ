// Gemelo de VideoPoster / VideoOldTV / VideoCinema / Playlist (#17): en papel no hay
// video; sale un QR vectorial de ≥ 0.6 in con zona de silencio y la
// leyenda "▶ Video: <título> — escanéalo" (pie, 7.5 pt). El export ya
// resolvió `url` y `qr`; con impreso.multimedia = "omitir" el nodo no llega.
#import "/print/lib/componentes/util.typ": *

#let video-poster(ctx, p, hijos) = {
  let G = geo.video
  let kind = p.at("kind", default: "video")
  let servicio = p.at("servicio", default: none)
  let prefijo = if kind == "playlist" { G.playlist_prefijo } else { G.leyenda_prefijo }
  // <Playlist servicio=…> (#17): «Playlist (Spotify): …».
  let prefijo = if servicio != none and servicio != "youtube" { prefijo + " (" + upper(servicio.first()) + servicio.slice(1) + ")" } else { prefijo }
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

// <VideoInstagram>: QR al reel. El SVG ya trae la zona de silencio (margin 4);
// `lado_cm` agranda el dibujo para que el símbolo (sin esa zona) mida ≥ qr_cm.
#let video-instagram(ctx, p, hijos) = {
  let G = geo.instagram
  let lado = float(p.lado_cm) * 1cm
  if lado < float(G.qr_cm) * 1cm {
    panic("VideoInstagram: el QR mide " + str(p.lado_cm) + " cm, menos de " + str(G.qr_cm) + " cm")
  }
  let c = colores(ctx)
  block(width: 100%, breakable: false, above: 8pt, below: 8pt, stroke: (paint: c.ink, thickness: 0.75pt), inset: 8pt,
    grid(columns: (auto, 1fr), column-gutter: 10pt, align: horizon,
      box(fill: blanco, qr(ctx, p.qr, lado: lado)),
      stack(dir: ttb, spacing: 4pt,
        texto("cuerpo_2col", quien: "VideoInstagram")[#G.leyenda],
        texto("pie", quien: "VideoInstagram")[#p.credito])))
}
