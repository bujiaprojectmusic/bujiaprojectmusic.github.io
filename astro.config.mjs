import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

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
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'monokai',
    },
  },
});
