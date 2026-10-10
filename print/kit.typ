// Catálogo impreso de componentes (issue #17): jirafa-kit.pdf (pantalla)
// y jirafa-kit-bn.pdf (bn). Es un volumen sintético que arma
// scripts/print/kit.ts desde src/components/fanzine/registro.json: una
// página por componente, compilada con los mismos gemelos que un volumen
// (print/lib/paginas.typ + componentes/), más una cabecera por página con
// el nombre del componente, su gemelo y el esquema.
//   typst compile --root . --font-path print/fonts --ignore-system-fonts \
//     --input variante=pantalla --input volumen=/print/build/kit/volumen.json print/kit.typ print/build/kit/jirafa-kit.pdf
#import "/print/lib/base.typ": *
#import "/print/lib/paginas.typ": render-volumen

#let ruta = sys.inputs.at("volumen", default: none)
#if ruta == none { panic("Falta --input volumen=/print/build/kit/volumen.json") }
#let vol = json(ruta)

#show: configurar.with(paginas: vol.paginas)
#show heading: it => it.body
#set document(title: "La Jirafa Elektrika — Kit de componentes", author: vol.autor)
#set text(fill: negro)

// Cabecera (en el margen superior, pestaña blanca sobre fondos a sangre):
// «KIT · Polaroid · imagenes.typ#polaroid · aprobado · rosa».
#let cabecera(k) = {
  let partes = ("KIT", k.nombre, k.typst.replace("print/lib/", "").replace("scripts/print/", ""), k.estado, "esquema " + k.esquema)
  box(fill: blanco, inset: pt(reglas.folio.pestana_relleno_pt),
    text(font: fuente-texto, size: pt(estilos.pie.pt), fill: negro, partes.join(" · ")))
}
#set page(header: context {
  let p = counter(page).get().first()
  let k = vol.kit.paginas.find(x => x.pagina == p)
  if k != none { align(if calc.odd(p) { right } else { left }, cabecera(k)) }
})

#render-volumen(vol)
