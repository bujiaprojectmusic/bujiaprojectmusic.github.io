// Lee el frontmatter de src/content/posts/**/*.mdx (JS plano, sin
// astro:content, porque corre en astro.config.mjs) y devuelve:
// - listFanzineRedirects(): las URLs viejas que sólo existen para
//   redirigir a /fanzine/vol-NN (fuera del sitemap).
// - listFanzinePrueba(): las URLs de los volúmenes de prueba
//   (`prueba: true`, noindex): también fuera del sitemap.
import fs from 'node:fs';
import path from 'node:path';

function listMdx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listMdx(p);
    return /\.mdx?$/.test(e.name) ? [p] : [];
  });
}

function entries(postsDir) {
  const out = [];
  for (const file of listMdx(postsDir)) {
    const src = fs.readFileSync(file, 'utf8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    if (!/^fanzine:\s*true\s*$/m.test(fm)) continue;
    if (/^draft:\s*true\s*$/m.test(fm)) continue;
    const volume = fm.match(/^volume:\s*(\d+)\s*$/m)?.[1];
    if (!volume) continue;
    // Slug de Astro: `slug:` del frontmatter, o la ruta relativa sin
    // extensión (una carpeta con index.mdx → el nombre de la carpeta).
    const rel = path.relative(postsDir, file).replace(/\\/g, '/').replace(/\.mdx?$/, '').replace(/\/index$/, '');
    const fileSlug = fm.match(/^slug:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? rel;
    const vol = `vol-${volume.padStart(2, '0')}`;
    const prueba = /^prueba:\s*true\s*$/m.test(fm);
    out.push({ fileSlug, vol, prueba });
  }
  return out;
}

export function listFanzineRedirects(postsDir = path.join('src', 'content', 'posts')) {
  const out = [];
  for (const e of entries(postsDir)) {
    if (!e.prueba) out.push(`/blog/${e.fileSlug}`);
    if (e.fileSlug !== e.vol) out.push(`/fanzine/${e.fileSlug}`);
  }
  return out;
}

export function listFanzinePrueba(postsDir = path.join('src', 'content', 'posts')) {
  return entries(postsDir)
    .filter((e) => e.prueba)
    .map((e) => `/fanzine/${e.vol}`);
}
