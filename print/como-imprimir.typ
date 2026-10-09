// "Cómo imprimir y engrapar" (issue #10): una página de media carta con
// los pasos para imprimir el cuadernillo en casa. Va aparte del
// cuadernillo para no romper el orden de doble cara.
//   typst compile --root . --font-path print/fonts --ignore-system-fonts \
//     --input volumen=/print/build/vol-01/volumen.json print/como-imprimir.typ salida.pdf
#import "/print/lib/base.typ": *
#import "/print/lib/componentes/util.typ": geo, qr, vol-nn

#let ruta = sys.inputs.at("volumen", default: none)
#if ruta == none { panic("Falta --input volumen=/print/build/<slug>/volumen.json") }
#let vol = json(ruta)
#let C = reglas.formato.cuadernillo
#let hojas = calc.quo(vol.paginas, 4)
#let ctx = (vol: vol, variante: variante)

#show: configurar.with(paginas: none)
#set document(title: "Cómo imprimir y engrapar — La Jirafa Elektrika Vol. " + str(vol.volumen))

#block(below: 8pt, rotate(-2deg, reflow: true, box(fill: negro, inset: (x: 10pt, y: 5pt),
  text(font: fuente-titulos, size: pt(estilos.titulo.pt_max) * 0.6, fill: blanco, upper("Cómo imprimir y engrapar")))))
#texto("pie", quien: "como-imprimir")[La Jirafa Elektrika · Vol. #vol-nn(vol.volumen) · #vol.titulo · #str(vol.paginas) páginas = #str(hojas) hojas carta]

#v(8pt)
#texto("cuerpo_1col", quien: "como-imprimir")[
  + *Elegí la versión.* #raw("jirafa-" + vol.slug + "-cuadernillo.pdf") para imprimir a color; #raw("jirafa-" + vol.slug + "-cuadernillo-xerox.pdf") para fotocopiar en blanco y negro (más barato, está pensado para eso).
  + *Papel carta* (#str(C.hoja_ancho_pt / 72) × #str(C.hoja_alto_pt / 72) in), *horizontal*. Cada cara trae dos páginas de media carta.
  + *Tamaño real, 100 %.* Sin "ajustar a página" ni "encoger al área imprimible". Si tu impresora recorta un poco la orilla, está bien: el texto respeta la zona segura de #str(reglas.margenes.zona_segura_in) in.
  + *Doble cara, voltear por el borde corto.* Es la opción que suele llamarse "short edge" o "voltear por el lado corto". Si tu impresora no imprime doble cara sola, imprimí las caras impares, volvé a meter las hojas por el borde corto e imprimí las pares.
  + *#str(hojas) hojas.* Apilalas en el orden en que salieron, sin cambiarlas de lado.
  + *Doblá a la mitad* la pila completa, con la portada afuera.
  + *Dos grapas en el lomo* (engrapadora de brazo largo, o abrí la engrapadora normal y doblá las patas por atrás).
]

#v(6pt)
#texto("pie", quien: "como-imprimir")[
  Antes de imprimir el volumen completo, probá con `jirafa-prueba-doble-cara.pdf` (hoja de prueba de #str(2) caras): si las cruces numeradas coinciden a contraluz, la impresora voltea bien por el borde corto.
]

#v(1fr)
#grid(columns: (auto, 1fr), column-gutter: 10pt, align: horizon,
  qr(ctx, vol.qr_volumen, lado: inch(geo.contraportada.qr_in)),
  texto("pie", quien: "como-imprimir")[Versión web y todas las descargas: #vol.url.replace("https://", "") \ Impreso en Texcoco, MX con Typst.])
