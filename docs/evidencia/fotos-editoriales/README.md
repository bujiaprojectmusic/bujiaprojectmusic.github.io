# Evidencia: fotos editoriales (`<Foto foto ancho>` y `<FotoCita>`)

Rama `claude/fanzine-fotos-editoriales` (desde main f5cd273). Capturas con
Playwright sobre `dist/` (390 y 1280 px) y páginas del PDF de `npm run print`
(60 dpi).

| Criterio | Evidencia |
|---|---|
| 1. `<FotoCita>`: foto a página completa con cita encima, web e impreso | `web-p8-*.png` (a todo el ancho de la columna, degradado al ink, Anton), `impreso-vol-01-pags-5-10-y-8-bn.png` (pág. 8 a sangre, color y B/N) |
| 1b. Sin resolución para sangre → con margen, sin escalar de más | `impreso-fotocita-marco-960px-color-y-bn.png` (960×1280 px → 146 ppi a sangre → modo marco a 315 pt) y `impreso-fixture-fotos-editoriales-pags-3-6.png` pág. 5 (200 px → 96 pt) |
| 1c. Cuenta para el múltiplo de 4 | vol-01 sigue en 12 páginas; `impreso-vol-01-fotos.md` |
| 2. `<Foto ancho="completo\|columna\|mitad">` entre párrafos, pie ≥ 7 pt, responsiva | `web-p5-1280.png` / `web-p5-390.png` (dos `mitad` lado a lado; 100 % en celular), `impreso-vol-01-pags-5-10-y-8-bn.png` (pie 7.5 pt = `estilos.pie` de reglas.json; `print:check` ok) |
| 3. Orden del MDX | pág. 5 web e impreso: título, h3, párrafo, foto, foto; test `fotos editoriales` en `tests/print/fixtures.test.mjs` revisa `['SectionTitle','parrafo','Foto','Foto','parrafo']` |
| 4. Guía y plantilla | `COMPONENTES_MDX.md` § 2c + tabla del catálogo; `src/content/piezas/_plantilla.mdx`; `README.md`; registro (`FotoCita` nuevo, `Foto` con `foto/ancho`); kit: `kit-Foto-*.png`, `kit-FotoCita-*.png` |
| 5. Pieza En vivo en la Escandón | `src/content/piezas/2026-10-en-vivo-en-la-escandon/index.mdx`: 7 fotos intercaladas + `<FotoCita>` con la frase de Mrk ("Desde el primer momento, se siente una vibra peculiar, armónica y placentera.") sobre la foto 02; `impreso-vol-01-fotos.md` |
| Build Astro, Typst, CI de letra mínima | ver abajo |

## Corridas

- `npm run build` ✔ (astro build + check-dist-volumenes + copy-dist).
- `npm run print` ✔: vol-01 12 págs, ppi mín 183 (advertencia por la portada y la foto 02 a sangre, 150–299), sin desbordes, letra mínima ok (`texto()` hace panic por debajo de `minimo_pt`).
- `npm run print:test` ✔ 13 fixtures (+ `fotos-editoriales`), `print:check` ✔, `print:kit` ✔ (Foto pág. 5, FotoCita pág. 6).
- `npm run test:content` ✔ 22, `test:web` ✔ 3, registro ✔ 6, `check:componentes` ✔ 47 (Foto/FotoCita/Pagina: 0.77 KB gzip con `src/styles/fotos-pieza.css`).
- `npm run qa:fanzine` ✔ sin errores (`qa-fanzine-informe.md`; axe 0 violaciones en /fanzine/vol-01 a 390 y 1280).
