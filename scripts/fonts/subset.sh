#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Regenera public/fonts/space-mono-{regular,bold}.woff2 a partir de las TTF
# oficiales de Google Fonts (repo google/fonts, carpeta ofl/spacemono, OFL)
# recortadas al rango "latin" de Google Fonts con pyftsubset (fonttools).
#
# Uso:   scripts/fonts/subset.sh                 (descarga + recorta + verifica)
#        FONTS_WORK=/ruta scripts/fonts/subset.sh --no-download
#                                                 (usa las .ttf ya descargadas en /ruta)
# Requiere: python3 + `pip install 'fonttools[woff]' brotli`, curl, sha256sum.
#
# Para actualizar la fuente: cambiar GF_SHA por el commit nuevo de
# google/fonts, borrar los sha256 esperados de abajo, correr el script y
# pegar los sha256 nuevos (TTF y woff2) acá y en public/fonts/README.txt.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

# Commit de google/fonts del que salen las TTF (rama main, 8 oct 2026).
GF_SHA="2eb0b48d5f760f62e286216f0859a8c540dbc1bd"
GF_RAW="https://raw.githubusercontent.com/google/fonts/${GF_SHA}"

# Rango "latin" de Google Fonts (el mismo unicode-range de global.css).
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

# Las TTF se bajan a un directorio temporal (no quedan en el repo).
WORK="${FONTS_WORK:-$(mktemp -d)}"
OUT="public/fonts"
mkdir -p "$WORK" "$OUT"

# sha256 de las TTF originales en ese commit (para detectar un cambio de
# fuente o una descarga corrupta).
declare -A TTF_SHA=(
  [SpaceMono-Regular.ttf]="95837e182baeeada83368f7748db28357f0a1b75c6b84ff7065b5edf933c8e18"
  [SpaceMono-Bold.ttf]="405e73d41afb7e5906efce206a326af5c956f38e255f35421c260e861e599c59"
)

if [[ "${1:-}" != "--no-download" ]]; then
  for f in SpaceMono-Regular.ttf SpaceMono-Bold.ttf; do
    curl -sSfL -o "$WORK/$f" "$GF_RAW/ofl/spacemono/$f"
  done
  curl -sSfL -o "$OUT/OFL-SpaceMono.txt" "$GF_RAW/ofl/spacemono/OFL.txt"
  curl -sSfL -o "$OUT/OFL-Anton.txt" "$GF_RAW/ofl/anton/OFL.txt"
fi

for f in "${!TTF_SHA[@]}"; do
  got=$(sha256sum "$WORK/$f" | cut -d' ' -f1)
  if [[ "$got" != "${TTF_SHA[$f]}" ]]; then
    echo "sha256 de $f no coincide con el esperado para google/fonts@$GF_SHA" >&2
    echo "  esperado ${TTF_SHA[$f]}" >&2; echo "  obtenido $got" >&2; exit 1
  fi
done

subset() {
  local in="$1" out="$2"
  python3 -m fontTools.subset "$in" \
    --output-file="$out" \
    --flavor=woff2 \
    --unicodes="$LATIN" \
    --layout-features='*' \
    --name-IDs='*' \
    --notdef-outline
}
subset "$WORK/SpaceMono-Regular.ttf" "$OUT/space-mono-regular.woff2"
subset "$WORK/SpaceMono-Bold.ttf"    "$OUT/space-mono-bold.woff2"

echo "google/fonts @ $GF_SHA"
python3 - <<'PY'
import sys
from fontTools import version as ftv
import brotli
print(f"fonttools {ftv} · brotli {brotli.__version__} · python {sys.version.split()[0]}")
PY
ls -l "$OUT"/space-mono-*.woff2
sha256sum "$OUT"/space-mono-*.woff2 "$OUT"/OFL-*.txt
