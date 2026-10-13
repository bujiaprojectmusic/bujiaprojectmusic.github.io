## QA del fanzine (npm run qa:fanzine) — 21.9 s

| Chequeo | Estado | Resumen | Errores | Avisos |
|---|:-:|---|---:|---:|
| Enlaces y anclas | ⚠️ | 2646 enlaces internos, 52 anclas, 22 externos distintos (0 ok, 22 sin respuesta) | 0 | 22 |
| Índice ↔ pliegos y lista de volúmenes | ✅ | vol-00 (MDX): 15 entradas en el índice, 20 pliegos (títulos escritos a mano: sólo se revisan anclas y números) · vol-01: 2 piezas en el yml, 2 entradas en el índice, 12 pliegos | 0 | 0 |
| Metadatos y créditos | ✅ | 163 <img> en /fanzine/** · vol-00 (MDX): créditos escritos a mano en el MDX, sólo se revisan los alt · vol-01: 2 piezas, 2 créditos visibles | 0 | 0 |
| Privacidad (correos y teléfonos) | ✅ | 31 archivos revisados, 3 excepciones | 0 | 0 |
| Accesibilidad (axe) | ✅ | 6 páginas × 2 anchos · 0 graves, 0 menores | 0 | 0 |
| Impreso: desbordes | ✅ | vol-00: 20 págs, mapa ok · vol-01: 12 págs, mapa ok | 0 | 0 |
| Impreso: tamaño mínimo de letra | ✅ | vol-00: mínimo medido 7.5 pt · vol-01: mínimo medido 7.5 pt (regla: ≥ 7 pt) | 0 | 0 |
| Impreso: páginas | ✅ | vol-00: 20 · vol-01: 12 (regla: múltiplo de 4, ≥ 4, recomendado ≥ 12) | 0 | 0 |
| Impreso: ppi de las fotos | ⚠️ | vol-00: mínimo 346 ppi · vol-01: mínimo 183 ppi | 0 | 2 |
| Impreso: gemelos Typst | ✅ | 2 volúmenes exportados con gemelo para cada componente (el registro de aprobados llega con #17) | 0 | 0 |
| Impreso: reglas.json vs docs (print:check) | ✅ | ✔ docs/IMPRESO.md: tablas iguales a print/reglas.json | 0 | 0 |

### ⚠️ Enlaces y anclas

- ⚠️ `dist/archive/16-de-mayo/index.html:35`: enlace externo sin respuesta (ENOTFOUND): https://facebook.com/bujiaprojectmusic (+22 más)
- ⚠️ `dist/archive/16-de-mayo/index.html:83`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=dXZvivMTrwk
- ⚠️ `dist/archive/16-de-mayo/index.html:96`: enlace externo sin respuesta (ENOTFOUND): https://www.google.com/maps/search/?api=1&query=Abasolo%20105%2C%20Col.%20del%20Carmen%2C%20Texcoco%2C%20Estado%20de%20M%C3%A9xico%2C%20M%C3%A9xico (+22 más)
- ⚠️ `dist/archive/primera-skatelecaster/index.html:181`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=WeskeKCP_UA
- ⚠️ `dist/fanzine/kit/fachadas/index.html:25`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=C1vfbwwdtOQ (+11 más)
- ⚠️ `dist/fanzine/kit/fachadas/index.html:25`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/playlist?list=PLzMaYoBMVrDm6n8BMuAVIctRy7GFBR5Ef (+4 más)
- ⚠️ `dist/fanzine/kit/index.html:179`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube-nocookie.com/embed/C1vfbwwdtOQ (+3 más)
- ⚠️ `dist/fanzine/vol-00/index.html:72`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=ZemHulXvqVY
- ⚠️ `dist/fanzine/vol-00/index.html:79`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=GiLZ5FB2LYU
- ⚠️ `dist/fanzine/vol-00/index.html:93`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube.com/watch?v=-8uBYIwMevA
- ⚠️ `dist/fanzine/vol-00/index.html:94`: enlace externo sin respuesta (ENOTFOUND): https://www.daddario.com/
- ⚠️ `dist/fanzine/vol-00/index.html:95`: enlace externo sin respuesta (ENOTFOUND): https://www.ernieball.com/
- ⚠️ `dist/fanzine/vol-00/index.html:103`: enlace externo sin respuesta (ENOTFOUND): https://www.ehx.com/
- ⚠️ `dist/fanzine/vol-00/index.html:103`: enlace externo sin respuesta (ENOTFOUND): https://www.fender.com/
- ⚠️ `dist/fanzine/vol-00/index.html:115`: enlace externo sin respuesta (ENOTFOUND): https://www.kexp.org/
- ⚠️ `dist/fanzine/vol-00/index.html:116`: enlace externo sin respuesta (ENOTFOUND): https://www.seymourduncan.com/
- ⚠️ `dist/fanzine/vol-00/index.html:117`: enlace externo sin respuesta (ENOTFOUND): https://www.stewmac.com/
- ⚠️ `dist/fanzine/vol-00/index.html:72`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube-nocookie.com/embed/ZemHulXvqVY
- ⚠️ `dist/fanzine/vol-00/index.html:79`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube-nocookie.com/embed/GiLZ5FB2LYU
- ⚠️ `dist/fanzine/vol-00/index.html:82`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube-nocookie.com/embed/videoseries?list=PLzMaYoBMVrDm6n8BMuAVIctRy7GFBR5Ef
- ⚠️ `dist/fanzine/vol-00/index.html:93`: enlace externo sin respuesta (ENOTFOUND): https://www.youtube-nocookie.com/embed/-8uBYIwMevA
- ⚠️ `dist/nosotros/index.html:87`: enlace externo sin respuesta (ENOTFOUND): https://www.google.com/maps?q=Abasolo%20105%2C%20Col.%20del%20Carmen%2C%20Texcoco%2C%20Estado%20de%20M%C3%A9xico%2C%20M%C3%A9xico&output=embed

### ⚠️ Impreso: ppi de las fotos

- ⚠️ `vol-01`: pliego 1 Portada: 183 ppi (src/assets/piezas/vol-01/portada.jpg)
- ⚠️ `vol-01`: pliego 8 FotoCita: 183 ppi (src/assets/piezas/2026-10-en-vivo-en-la-escandon/02-black-lipstick-earth-angel.jpeg)

<details><summary>Detalles</summary>

**Índice ↔ pliegos y lista de volúmenes**

- vol-00 (MDX): 15 entradas en el índice, 20 pliegos (títulos escritos a mano: sólo se revisan anclas y números)
- vol-01: 2 piezas en el yml, 2 entradas en el índice, 12 pliegos

**Metadatos y créditos**

- 163 <img> en /fanzine/**
- vol-00 (MDX): créditos escritos a mano en el MDX, sólo se revisan los alt
- vol-01: 2 piezas, 2 créditos visibles

**Privacidad (correos y teléfonos)**

- 31 archivos revisados, 3 excepciones

**Accesibilidad (axe)**

- /fanzine @ 390px: 0 violaciones (0 graves), 32 reglas ok
- /fanzine @ 1280px: 0 violaciones (0 graves), 32 reglas ok
- /fanzine/colabora @ 390px: 0 violaciones (0 graves), 34 reglas ok
- /fanzine/colabora @ 1280px: 0 violaciones (0 graves), 34 reglas ok
- /volumenes @ 390px: 0 violaciones (0 graves), 32 reglas ok
- /volumenes @ 1280px: 0 violaciones (0 graves), 32 reglas ok
- /fanzine/colabora/enviar @ 390px: 0 violaciones (0 graves), 46 reglas ok
- /fanzine/colabora/enviar @ 1280px: 0 violaciones (0 graves), 45 reglas ok
- /fanzine/vol-00 @ 390px: 0 violaciones (0 graves), 40 reglas ok
- /fanzine/vol-00 @ 1280px: 0 violaciones (0 graves), 40 reglas ok
- /fanzine/vol-01 @ 390px: 0 violaciones (0 graves), 39 reglas ok
- /fanzine/vol-01 @ 1280px: 0 violaciones (0 graves), 39 reglas ok

</details>

