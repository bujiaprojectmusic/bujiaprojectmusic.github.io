Acá viven todas las fotos e ilustraciones del sitio (antes estaban en
public/img/). Astro las optimiza al compilar: AVIF/WebP, varios anchos
(srcset), width/height, y una variante grande para el PDF del fanzine.

En los MDX y en el frontmatter se siguen escribiendo con la ruta de
siempre: "/img/carpeta/archivo.jpg" (ver src/utils/resolveImage.ts).
Para agregar una foto: copiarla acá adentro, en la carpeta que
corresponda, y referenciarla con esa ruta. No hace falta achicarla.

En public/img/ sólo quedan los archivos que se sirven tal cual (videos).
