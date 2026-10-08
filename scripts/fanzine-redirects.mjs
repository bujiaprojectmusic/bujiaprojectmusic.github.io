// Lista las rutas de REDIRECCIÓN del fanzine (las URLs viejas que siguen
// existiendo sólo para mandar a /fanzine/vol-NN), leyendo el frontmatter
// de src/content/posts/*.mdx. Lo usa astro.config.mjs para dejarlas fuera
// del sitemap. Es JS plano (sin astro:content) porque corre en la config.
import fs from 'node:fs';
import path from 'node:path';

export function listFanzineRedirects(postsDir = path.join('src', 'content', 'posts')) {
  const out = [];
  if (!fs.existsSync(postsDir)) return out;
  for (const file of fs.readdirSync(postsDir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const src = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    if (!/^fanzine:\s*true\s*$/m.test(fm)) continue;
    if (/^draft:\s*true\s*$/m.test(fm)) continue;
    const volume = fm.match(/^volume:\s*(\d+)\s*$/m)?.[1];
    if (!volume) continue;
    const fileSlug = fm.match(/^slug:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? file.replace(/\.mdx?$/, '');
    const vol = `vol-${volume.padStart(2, '0')}`;
    out.push(`/blog/${fileSlug}`);
    if (fileSlug !== vol) out.push(`/fanzine/${fileSlug}`);
  }
  return out;
}
