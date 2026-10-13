# Evidencia del issue #40: /fanzine como puesto de revistas

Capturas con Playwright (Chromium) sobre `dist/` servido con `astro preview`,
a 390 px (móvil) y 1280 px (escritorio), página completa.

**Estado real de producción (estado vacío).** Hoy no hay ningún volumen
público: vol-00 es `prueba: true` y vol-01 es `sin_listar: true`. Por eso el
build real muestra el estado vacío: `vacio-390.png`, `vacio-1280.png`.

**Puesto con portadas (build de demostración).** Para mostrar la repisa con
portadas se hizo un build local temporal con vol-01 en `sin_listar: false` y
vol-00 en `prueba: false`. Esos dos cambios NO se commitearon: los archivos
se restauraron antes del build real. Capturas: `puesto-390.png`,
`puesto-1280.png` y, con foco de teclado en la primera portada,
`puesto-foco-390.png` y `puesto-foco-1280.png`. vol-00 no tiene portada, así
que se ve el respaldo (cartel rosa con el título).

| Criterio del issue | Evidencia |
|---|---|
| Descripción nueva editable, con link a colaborar | `src/content/pages/fanzine-indice.mdx`; todas las capturas |
| Portadas, del más reciente al más antiguo | `puesto-*.png`: Vol. 01 antes que Vol. 00 (orden por número de volumen) |
| Sticker "Vol. XX" amarillo, rosa o negro | `puesto-*.png` |
| Enlace por portada, foco accesible, alt con el título | `puesto-foco-*.png`; alt "Portada del Vol. 01: La Jirafa Elektrika"; axe sin violaciones (`qa-fanzine-informe.md`) |
| Ocultos y sin listar fuera | build real: 0 enlaces a volúmenes en `/fanzine`; `check-dist-volumenes` ✔ |
| Estado vacío | `vacio-*.png` |
| Responsivo: 2 por fila en móvil, sin scroll horizontal | `puesto-390.png` (`scrollWidth` 390) |
| Presupuesto | `presupuesto-fanzine.md` |
