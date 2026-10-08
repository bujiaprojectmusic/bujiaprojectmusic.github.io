Fuentes self-hosted del sitio (todas OFL 1.1, licencias en esta carpeta).

space-mono-regular.woff2 / space-mono-bold.woff2  (Space Mono 400 y 700)
  Origen:   repo google/fonts, carpeta ofl/spacemono
            (SpaceMono-Regular.ttf, SpaceMono-Bold.ttf, OFL.txt)
  Commit:   2eb0b48d5f760f62e286216f0859a8c540dbc1bd  (main, 8 oct 2026)
            sha256 TTF: Regular 95837e18…933c8e18 · Bold 405e73d4…e599c59
  Recorte:  pyftsubset (fonttools 4.66.1 + brotli 1.2.0, Python 3.13) al rango
            "latin" de Google Fonts, que es el mismo unicode-range que llevan
            los @font-face en src/styles/global.css:
              U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
              U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193,
              U+2212, U+2215, U+FEFF, U+FFFD
            con --flavor=woff2 --layout-features='*' --name-IDs='*'
            --notdef-outline (se conservan todas las features OpenType del
            rango —Space Mono no trae kerning: es monoespaciada— y el hinting).
  Cómo regenerar:  scripts/fonts/subset.sh   (descarga las TTF del commit de
            arriba, verifica su sha256, recorta y copia las licencias).
  Licencia: OFL-SpaceMono.txt (= ofl/spacemono/OFL.txt de ese commit).

anton-regular.woff2  (Anton 400)
  Ya estaba en el repo; no se regenera con el script.
  Licencia: OFL-Anton.txt (= ofl/anton/OFL.txt de google/fonts @ 2eb0b48d).

Los @font-face viven en src/styles/global.css (font-display: swap +
unicode-range). BaseLayout.astro y TallerLayout.astro precargan
anton-regular.woff2 y space-mono-regular.woff2.
