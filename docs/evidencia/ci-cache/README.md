# Evidencia: CI que verifica sólo lo que cambió y caché de PDF por volumen

## 1. Primer run del PR (run 38442647251)

El PR toca el motor del impreso (`scripts/print/`) y la caché estaba vacía:
se compila todo, como corresponde. Job `cambios`: motor y web en true.

| Paso del job `build` | Tiempo |
|---|---|
| PDF de los volúmenes (Typst) | 24 s |
| Kit de componentes | 52 s |
| Tests del motor (fixtures) | 63 s |
| Build de Astro | 31 s |
| Presupuesto de datos | 36 s |
| QA del fanzine | 15 s |

Al final se guardó `print/cache` con `actions/cache` (3 s).

## 2. Segundo run, mismo PR, sin cambios de contenido ni motor

Este archivo es el único cambio del segundo commit. Las huellas de los
volúmenes y del kit no cambian, así que los PDF deben salir de la caché.
Los resultados se agregan al PR.
