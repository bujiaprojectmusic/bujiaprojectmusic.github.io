// Hoja de prueba de doble cara (issue #16): carta horizontal, 2 caras,
// cruces de registro que deben coincidir a contraluz, con la leyenda
// "frente / vuelta, voltear por el borde corto". Medidas de reglas.json.
#import "/print/lib/base.typ": reglas, pt, tinta, fuente-texto, fuente-titulos, estilos

#let C = reglas.formato.cuadernillo
#let P = reglas.prueba
#let W = pt(C.hoja_ancho_pt)
#let H = pt(C.hoja_alto_pt)
#let m = pt(P.doble_cara_cruz_margen_pt)
#let L = pt(P.doble_cara_cruz_largo_pt)

#set page(width: W, height: H, margin: 0pt)
#set text(font: fuente-texto, size: pt(estilos.cuerpo_1col.pt), lang: reglas.tipografia.lang)

// Cruz de registro con su número. El número va hacia el centro de la hoja
// (dx/dy = ±1): en la vuelta queda del otro lado, en espejo.
#let cruz(x, y, n, hx, hy) = {
  place(top + left, dx: x - L / 2, dy: y, line(length: L, stroke: 0.5pt + black))
  place(top + left, dx: x, dy: y - L / 2, line(angle: 90deg, length: L, stroke: 0.5pt + black))
  place(top + left, dx: x - L / 4, dy: y - L / 4, circle(radius: L / 4, stroke: 0.5pt + black))
  // Caja de ancho L pegada al brazo: el número empieza (hx = 1) o termina
  // (hx = -1) exactamente a L/2 + 2 pt del centro de la cruz.
  let bx = if hx > 0 { x + L / 2 + 2pt } else { x - L / 2 - 2pt - L }
  let by = if hy > 0 { y + L / 2 + 2pt } else { y - L / 2 - 2pt - 10pt }
  place(top + left, dx: bx, dy: by,
    box(width: L, align(if hx > 0 { left } else { right }, text(font: fuente-texto, weight: "bold", size: pt(estilos.folio.pt))[#n])))
}
// Cuatro cruces numeradas a `m` de cada borde. En la vuelta van en espejo
// horizontal (la 1 pasa de arriba-izquierda a arriba-derecha, etc.): al
// voltear la hoja por el borde corto, cada número cae sobre el mismo número.
#let cara(nombre, espejo: false) = {
  let esq = ((1, m, m, 1, 1), (2, W - m, m, -1, 1), (3, m, H - m, 1, -1), (4, W - m, H - m, -1, -1))
  for (n, x, y, hx, hy) in esq {
    let xx = if espejo { W - x } else { x }
    let hhx = if espejo { -hx } else { hx }
    cruz(xx, y, n, hhx, hy)
  }
  // Línea central (lomo del cuadernillo)
  place(top + left, dx: W / 2, dy: m, line(angle: 90deg, length: H - 2 * m, stroke: (paint: black, thickness: 0.5pt, dash: "dashed")))
  place(center + horizon, block(fill: white, inset: 10pt, width: W * 0.6, align(center)[
    #text(font: fuente-titulos, size: pt(estilos.titulo.pt_max))[#nombre]
    #v(8pt)
    #text(size: pt(estilos.indice.pt))[Hoja de prueba de doble cara · carta horizontal #str(C.hoja_ancho_pt) × #str(C.hoja_alto_pt) pt]
    #v(4pt)
    #text(size: pt(estilos.indice.pt), weight: "bold")[Imprimir a doble cara volteando por el *borde corto*.]
    #v(4pt)
    #text(size: pt(estilos.pie.pt))[Las cruces de las esquinas deben coincidir al ver la hoja a contraluz (±1 mm), número sobre número. La línea punteada es el lomo: cada cara lleva #str(C.paginas_por_cara) páginas de #str(reglas.formato.corte.ancho_pt) × #str(reglas.formato.corte.alto_pt) pt.]
  ]))
  // Dos cajas de página de media carta, para ver el corte.
  for i in range(C.paginas_por_cara) {
    let x = W / 2 - pt(reglas.formato.corte.ancho_pt) + i * pt(reglas.formato.corte.ancho_pt)
    place(top + left, dx: x, dy: 0pt, rect(width: pt(reglas.formato.corte.ancho_pt), height: pt(reglas.formato.corte.alto_pt), stroke: (paint: tinta("#e4002b"), thickness: 0.5pt, dash: "dashed")))
  }
}

#cara("FRENTE")
#pagebreak()
#cara("VUELTA", espejo: true)
