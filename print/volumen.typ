// Punto de entrada del impreso de un volumen (issue #9):
//   typst compile --root . --font-path print/fonts --ignore-system-fonts \
//     --input variante=pantalla|imprenta|bn --input volumen=/print/build/vol-01/volumen.json \
//     print/volumen.typ print/build/vol-01/jirafa-vol-01-pantalla.pdf
// Todas las medidas salen de /print/reglas.json vía base.typ. Nada de
// scale() sobre texto: si no cabe, check.mjs falla con la pieza.
#import "/print/lib/base.typ": *
#import "/print/lib/paginas.typ": render-volumen

#let ruta = sys.inputs.at("volumen", default: none)
#if ruta == none { panic("Falta --input volumen=/print/build/<slug>/volumen.json") }
#let vol = json(ruta)

#show: configurar.with(paginas: vol.paginas)
// Los headings sólo existen para los marcadores (bookmarks) del PDF de
// pantalla: el look lo pinta cada gemelo.
#show heading: it => it.body
#set document(title: "La Jirafa Eléctrica Vol. " + str(vol.volumen) + " — " + vol.titulo, author: vol.autor)
#set text(fill: negro)

#render-volumen(vol)
