// Utilidades comunes de los gemelos Typst (#9): colores del esquema,
// imágenes por variante, recuadro de "imagen pendiente", QR.
// `ctx` (lo arma render.typ): (vol, variante, pantalla, n, esquema,
// colores: (ink, accent, paper), geo, render, inline).
#import "/print/lib/base.typ": *

#let geo = json("/print/componentes.json")
#let caja = caja-w

/// Colores del esquema `nombre` (o del pliego actual) pasados por tinta().
#let colores(ctx, nombre: none) = {
  let e = if nombre != none and nombre in ctx.vol.paleta { nombre } else if ctx.esquema != none and ctx.esquema in ctx.vol.paleta { ctx.esquema } else { ctx.vol.esquema }
  let c = ctx.vol.paleta.at(e)
  (ink: tinta(c.ink), accent: tinta(c.accent), paper: tinta(c.paper))
}

#let foto-de(ctx, id) = ctx.vol.fotos.find(f => f.id == id)

/// Archivo de la foto según la variante (imprenta = master; pantalla = 150 ppi; bn = gris).
#let archivo-foto(ctx, foto) = {
  if ctx.variante == "imprenta" { foto.imprenta } else if ctx.variante == "bn" { foto.bn } else { foto.pantalla }
}

/// Recuadro cuando la foto no existe en el repo (el build avisa, no falla).
#let pendiente(ctx, foto, width: 100%, height: 120pt) = {
  box(width: width, height: height, stroke: (paint: negro, thickness: 1pt, dash: "dashed"), inset: 8pt,
    align(center + horizon, texto("pie", quien: "imagen pendiente")[Imagen pendiente \ #foto.master]))
}

/// Ancho real de una foto limitada por `wmax` y por `alto-max-pct` de la
/// caja de texto (misma regla que anchoColocado() en export.ts → ppi).
#let ancho-ajustado(foto, wmax, alto-max-pct) = {
  if foto == none or not foto.existe or alto-max-pct == none or foto.alto_px == 0 { return wmax }
  let hmax = caja-h * alto-max-pct / 100
  calc.min(wmax, hmax * foto.ancho_px / foto.alto_px)
}

/// Imagen de la foto `id` al ancho `width` (pt o %). Si no existe, recuadro.
/// `alto-max-pct` achica una foto vertical para que quepa (sólo fotos; el texto no).
#let imagen(ctx, id, width: 100%, height: auto, fit: "contain", alto-max-pct: none) = {
  let foto = foto-de(ctx, id)
  if foto == none { panic("foto " + str(id) + " no está en volumen.json") }
  if not foto.existe { return pendiente(ctx, foto, width: width, height: if height == auto { 120pt } else { height }) }
  let archivo = archivo-foto(ctx, foto)
  let w = if alto-max-pct != none and type(width) == length { ancho-ajustado(foto, width, alto-max-pct) } else { width }
  // bn: los SVG quedan en color (Typst no recolorea vectores).
  image(archivo, width: w, height: height, fit: fit)
}

/// QR (SVG vectorial generado en el export) de `id`, de `lado` de lado.
#let qr(ctx, id, lado: none) = {
  let q = ctx.vol.qrs.find(q => q.id == id)
  if q == none { panic("QR " + str(id) + " no está en volumen.json") }
  let l = if lado == none { inch(geo.video.qr_in) } else { lado }
  image(q.archivo, width: l, height: l)
}

/// Triángulo "play" (Space Mono no trae ▶).
#let play(lado: 6pt, fill: black) = box(baseline: 10%, polygon(fill: fill, (0pt, 0pt), (lado, lado / 2), (0pt, lado)))

/// Giro limitado (los componentes web inclinan ±4°; en papel se acota).
#let giro(grados, max: 4) = calc.max(-max, calc.min(max, grados)) * 1deg

/// Mes y año en español desde "AAAA-MM-DD".
#let mes-anio(fecha) = {
  let partes = fecha.split("-")
  let meses = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
  let m = int(partes.at(1))
  upper(meses.at(m - 1).first()) + meses.at(m - 1).slice(1) + " " + partes.at(0)
}

/// Número de volumen con dos dígitos.
#let vol-nn(n) = if n < 10 { "0" + str(n) } else { str(n) }
