---
name: Componente punk
about: Un componente nuevo del fanzine aprobado por Ricardo en la puerta 2 (web + Typst + registro + docs + presupuesto).
title: "Componente: <Nombre>"
labels: fanzine, componente
assignees: ''
---

<!-- Un issue por componente APROBADO. Abrilo después de la puerta 2 del volumen;
     antes de eso la propuesta vive en el PR del volumen (repo fanzine-redaccion). -->

## Descripción y boceto

<!-- Qué es, para qué sirve en una nota, cómo se ve. Pegá el boceto (imagen) o un enlace. -->

## Aprobación (puerta 2)

- **Volumen:** Vol. NN
- **Fecha de aprobación de Ricardo:** AAAA-MM-DD
- **Propuesto por:** Redacción (PR del volumen: …)

## Props

<!-- Una fila por prop: nombre, tipo, default, obligatoria, qué es. -->

| Prop | Tipo | Default | Obligatoria | Qué es |
|---|---|---|---|---|
| `…` | `string` | — | sí | … |

## Ejemplo MDX

```mdx
import Nombre from '../../../components/fanzine/Nombre.astro';

<Nombre … />
```

## Criterios de aceptación

- [ ] **Web:** `src/components/…/Nombre.astro`, 0 JS, se ve en `/fanzine/kit` en los 3 esquemas (rosa, xerox, overol).
- [ ] **Typst:** gemelo en `print/lib/componentes/…typ` con el mismo look, plano y apto para tinta (sin transparencias ni *blend modes* para leerse, medidas desde `print/componentes.json`, tamaños de letra sólo desde `print/reglas.json`, nada fuera de la zona segura).
- [ ] **B/N:** legible en `jirafa-kit-bn.pdf` (escala de grises pura).
- [ ] **Registro:** entrada en `src/components/fanzine/registro.json` con `estado: aprobado`, `volumen`, `web`, `typst`, `props` y `demo`.
- [ ] **Docs:** fila y ejemplo en `COMPONENTES_MDX.md` (§ Catálogo).
- [ ] **Presupuesto:** CSS ≤ 1.5 KB gzip, SVG inline ≤ 2 KB gzip, sin imágenes raster (`npm run check:componentes` en verde).
- [ ] `npm run build`, `npm run print:kit`, `npm run print:test` y `npm run qa:fanzine` en verde.
