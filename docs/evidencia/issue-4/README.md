# Evidencia del PR que cierra #4 (optimizar imágenes con astro:assets)

Archivos generados sobre `npm run build && npx astro preview` en la rama
del PR, comparando contra `main` @ `5175fe4`.

- `*-antes-despues-diff.jpg`: captura **antes** (main) | **después**
  (esta rama) | **diff** (pixelmatch, rojo = píxel distinto) de `/`,
  `/nosotros` y `/fanzine` en desktop (1280 px) y móvil (390 px), a
  escala 50 %. Las dimensiones de página son idénticas en los 6 casos.
- `capturas-diff.json`: píxeles distintos por captura (máx. 0,51 %).
- `lighthouse-antes-despues.json`: Lighthouse móvil (`--form-factor=mobile
  --only-categories=performance`) en `/`, `/nosotros`,
  `/archive/primera-skatelecaster`, `/fanzine` y `/blog/volumen-01`.
- `print-currentSrc.json`: para `/blog/volumen-01`, `/nosotros` y
  `/archive/primera-skatelecaster`, el `currentSrc` y `naturalWidth` de
  cada `<img>` con emulación de media `screen` vs `print` (Playwright
  `page.emulateMedia({ media: 'print' })`). En print todas las fotos
  cargan la variante WebP de 2400 px (o el original si mide menos).

Los scripts que los generaron están descritos en el PR. Esta carpeta se
puede borrar después de revisar el PR.
