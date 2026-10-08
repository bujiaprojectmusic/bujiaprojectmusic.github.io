#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Instala Typst con la versión FIJADA en print/TYPST_VERSION, bajando el
# binario oficial de github.com/typst/typst/releases y verificando su
# sha256 contra print/typst.sha256. Sin `latest`.
#
# Uso:  scripts/print/install-typst.sh            → instala en print/build/bin/typst
#       TYPST_INSTALL_DIR=/ruta scripts/print/install-typst.sh
# Sólo está fijado el binario de Linux x86_64 (el que usa CI). En otra
# plataforma: instalá a mano la MISMA versión (brew/cargo/release) y el
# build la acepta si `typst --version` coincide.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION="$(tr -d '[:space:]' < print/TYPST_VERSION)"
ASSET="typst-x86_64-unknown-linux-musl.tar.xz"
URL="https://github.com/typst/typst/releases/download/v${VERSION}/${ASSET}"
DEST="${TYPST_INSTALL_DIR:-print/build/bin}"
CACHE="${TYPST_CACHE_DIR:-print/build/typst-dl}"
ESPERADO="$(grep " ${ASSET}\$" print/typst.sha256 | cut -d' ' -f1)"

if [[ -z "$ESPERADO" ]]; then
  echo "print/typst.sha256 no tiene la línea de ${ASSET}" >&2; exit 1
fi
if [[ "$(uname -s)-$(uname -m)" != "Linux-x86_64" ]]; then
  echo "Este script sólo instala el binario fijado de Linux x86_64 (uname: $(uname -s)-$(uname -m))." >&2
  echo "Instalá Typst ${VERSION} a mano y dejalo en PATH o en TYPST_BIN." >&2; exit 2
fi

mkdir -p "$CACHE" "$DEST"
if [[ ! -f "$CACHE/$ASSET" ]]; then
  echo "Descargando Typst ${VERSION}: ${URL}"
  curl -sSfL --retry 3 -o "$CACHE/$ASSET" "$URL"
fi
OBTENIDO="$(sha256sum "$CACHE/$ASSET" | cut -d' ' -f1)"
if [[ "$OBTENIDO" != "$ESPERADO" ]]; then
  echo "✖ sha256 de ${ASSET} NO coincide:" >&2
  echo "    esperado (print/typst.sha256): $ESPERADO" >&2
  echo "    obtenido:                      $OBTENIDO" >&2
  rm -f "${CACHE:?}/${ASSET:?}"
  exit 1
fi
echo "✔ sha256 verificado: ${OBTENIDO}  ${ASSET}"
tar -xJf "$CACHE/$ASSET" -C "$CACHE"
install -m 0755 "$CACHE/typst-x86_64-unknown-linux-musl/typst" "$DEST/typst"

VISTA="$("$DEST/typst" --version | awk '{print $2}')"
if [[ "$VISTA" != "$VERSION" ]]; then
  echo "✖ typst --version dice ${VISTA}, pero print/TYPST_VERSION pide ${VERSION}" >&2; exit 1
fi
echo "✔ typst ${VISTA} instalado en ${DEST}/typst"
