# Fuentes del impreso (Typst)

Typst no usa los `.woff2` recortados del sitio (`public/fonts/`): necesita
las TTF completas. Estas vienen del repo `google/fonts` en el **mismo
commit `2eb0b48d5f760f62e286216f0859a8c540dbc1bd`** que documenta
`public/fonts/README.txt`, sin modificar:

| Archivo | Origen en google/fonts | Licencia |
|---|---|---|
| Anton-Regular.ttf | ofl/anton/Anton-Regular.ttf | OFL-Anton.txt |
| SpaceMono-Regular.ttf | ofl/spacemono/SpaceMono-Regular.ttf | OFL-SpaceMono.txt |
| SpaceMono-Bold.ttf | ofl/spacemono/SpaceMono-Bold.ttf | OFL-SpaceMono.txt |
| SpaceMono-Italic.ttf | ofl/spacemono/SpaceMono-Italic.ttf | OFL-SpaceMono.txt |
| SpaceMono-BoldItalic.ttf | ofl/spacemono/SpaceMono-BoldItalic.ttf | OFL-SpaceMono.txt |

`SHA256SUMS` tiene el sha256 de cada archivo; `sha256sum -c SHA256SUMS`
desde esta carpeta los verifica (lo hace `npm run print:prueba`). Typst
corre con `--font-path print/fonts --ignore-system-fonts`, así que sólo
estas fuentes pueden terminar en un PDF.
