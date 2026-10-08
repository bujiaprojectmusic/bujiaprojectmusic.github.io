# Paquetes Typst vendorizados

Nada se descarga al compilar (`typst compile` corre sin red). Cada paquete
va con su versión en el nombre de la carpeta, su licencia y el commit de
origen; se importa por ruta (`#import "/print/vendor/<paquete>/<entrada>.typ"`).

| Paquete | Versión | Origen | Commit | Licencia | Para qué |
|---|---|---|---|---|---|
| wrap-it | 0.1.1 | https://github.com/ntjess/wrap-it | fb225204a6dde4f607965c041829c56ec0ec6e39 | Unlicense (dominio público) | Texto que rodea una figura (`<ImageSide>` del fanzine, #9) |

## Parches locales

- `wrap-it-0.1.1/wrap-it.typ`, función `_rewrap`: los elementos con
  `children` que no son `sequence` (enum, list, grid, stack, terms) se
  reconstruyen con los hijos como posicionales sueltos. Sin el parche, una
  lista dentro del texto que rodea una `<ImageSide>` hacía fallar Typst
  0.15.1 con "array must contain exactly two entries". Marcado con
  `PARCHE LOCAL` en el archivo.
- `wrap-it-0.1.1/wrap-it.typ`, función `split-has-children`: en `enum` y
  `list` los ítems no se parten al rodear la figura (el que no cabe pasa
  entero debajo) y el `enum` de abajo continúa la numeración (`start`).
