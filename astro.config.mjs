import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { listFanzineRedirects } from './scripts/fanzine-redirects.mjs';

// URLs viejas del fanzine que sólo existen para redirigir a /fanzine/vol-NN
// (meta refresh + canonical). No van al sitemap.
const fanzineRedirects = new Set(listFanzineRedirects());

export default defineConfig({
  // Dominio real del sitio (GitHub Pages con dominio propio). De acá salen
  // el sitemap y las URLs canónicas; antes se armaba a partir de
  // GITHUB_REPOSITORY y apuntaba a *.github.io.
  site: 'https://bujiaprojectmusic.com',
  base: '/',
  trailingSlash: 'never',
  // Caché de imágenes optimizadas (astro:assets). Por default Astro la
  // guarda en node_modules/.astro, que `npm ci` borra en cada build de
  // CI; la movemos afuera para poder cachearla con actions/cache (ver
  // .github/workflows/deploy.yml) y no reprocesar las fotos que no
  // cambiaron. Está en .gitignore.
  cacheDir: './.astro-cache',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !fanzineRedirects.has(new URL(page).pathname.replace(/\/$/, '')),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'monokai',
    },
  },
});
