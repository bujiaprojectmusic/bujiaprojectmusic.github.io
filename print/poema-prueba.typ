// Una página del poema en borrador. No es un volumen: no entra al manifest
// ni se publica. Lo compila scripts/print/build.mjs al final de `npm run print`.
#import "/print/lib/base.typ": *
#import "/print/lib/render.typ": render-nodos, contexto

#let data = json("/print/build/poema-prueba/poema.json")
#show: configurar.with(paginas: 1)
#set document(title: "Poema de prueba — La Jirafa Elektrika", author: data.vol.autor)
#let ctx = contexto(data.vol, 1, data.vol.esquema)
#render-nodos(ctx, data.nodos)
