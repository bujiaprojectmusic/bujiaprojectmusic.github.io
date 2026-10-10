// Presupuesto por componente (issue #17, restricción 2): para cada entrada
// del registro (src/components/fanzine/registro.json) mide el CSS de sus
// <style> y el SVG inline de su .astro (gzip), y falla si alguno rebasa
// limites.css_gzip_kb / svg_gzip_kb. Además: ninguna textura, cinta ni
// sello raster (grep de url(*.png|jpg|webp|avif) en src/components/fanzine/
// y src/styles/) y el script de fachada ≤ script_fachada_gzip_kb.
//   npm run check:componentes [--md salida.md]
// Imprime la tabla (Markdown) y la agrega al Job summary de Actions.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registro = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'components', 'fanzine', 'registro.json'), 'utf8'));
const L = registro.limites;
const gz = (s) => (s ? zlib.gzipSync(Buffer.from(s)).length : 0);
// Lo que se publica: Astro/esbuild minifican el CSS (sin comentarios ni espacios). Se mide así.
const minCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').trim();
const kb = (b) => (b / 1024).toFixed(2);
const args = process.argv.slice(2);
const md = args.includes('--md') ? args[args.indexOf('--md') + 1] : null;

const bloques = (src, re) => [...src.matchAll(re)].map((m) => m[1] ?? m[0]).join('\n');
const CSS_RE = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;
const SVG_RE = /<svg[\s\S]*?<\/svg>/g;

const filas = [];
const fallos = [];
for (const c of registro.componentes) {
  if (!c.web) continue;
  if (c.tipo === 'estilo' && !/\.(css|astro)$/.test(c.web)) { filas.push({ nombre: c.nombre, estado: c.estado, web: c.web, css: null, svg: null, ok: true }); continue; }
  const archivo = path.join(RAIZ, c.web);
  if (!fs.existsSync(archivo)) { fallos.push(`${c.nombre}: no existe ${c.web}`); continue; }
  const src = fs.readFileSync(archivo, 'utf8');
  let css = 0, svg = 0;
  if (c.web.endsWith('.css')) css = gz(minCss(src));
  else if (c.web.endsWith('.astro')) { css = gz(minCss(bloques(src, CSS_RE))); svg = gz(bloques(src, SVG_RE)); }
  // Sticker incrusta los SVG de marca (o sus placeholders de utils/fanzineAssets.ts): se mide el placeholder más pesado.
  if (c.nombre === 'Sticker' || c.nombre === 'Cinta' || c.nombre === 'Parche') {
    const util = fs.readFileSync(path.join(RAIZ, 'src', 'utils', 'fanzineAssets.ts'), 'utf8');
    const ph = [...util.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => gz(m[0]));
    svg = Math.max(svg, ...ph);
  }
  const ok = css <= L.css_gzip_kb * 1024 && svg <= L.svg_gzip_kb * 1024;
  if (!ok) fallos.push(`${c.nombre}: CSS ${kb(css)} KB / SVG ${kb(svg)} KB gzip (límites ${L.css_gzip_kb} / ${L.svg_gzip_kb})`);
  filas.push({ nombre: c.nombre, estado: c.estado, web: c.web, css, svg, ok });
}

// Script de fachada (único JS permitido en componentes): Fachada.astro <script>.
const fachada = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'content', 'Fachada.astro'), 'utf8');
const js = bloques(fachada, /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g);
const jsGz = gz(js);
if (jsGz > L.script_fachada_gzip_kb * 1024) fallos.push(`script de fachada: ${jsGz} B gzip (> ${L.script_fachada_gzip_kb} KB)`);

// Nada raster para texturas, cintas ni sellos.
let raster = '';
try {
  raster = execFileSync('grep', ['-REn', 'url\\([^)]*\\.(png|jpe?g|webp|avif)', 'src/components/fanzine/', 'src/styles/'], { cwd: RAIZ, encoding: 'utf8' });
} catch (e) { raster = e.status === 1 ? '' : (e.stdout || ''); }
if (raster.trim()) fallos.push(`imágenes raster en CSS:\n${raster.trim()}`);

const lineas = [];
lineas.push(`## Presupuesto por componente (#17): CSS ≤ ${L.css_gzip_kb} KB gzip, SVG inline ≤ ${L.svg_gzip_kb} KB gzip`, '');
lineas.push('| Componente | Estado | Archivo | CSS gzip | SVG gzip | |', '|---|---|---|---|---|---|');
for (const f of filas) lineas.push(`| ${f.nombre} | ${f.estado} | \`${f.web}\` | ${f.css == null ? 'estilos globales, n/a' : kb(f.css) + ' KB'} | ${f.svg == null ? '—' : kb(f.svg) + ' KB'} | ${f.ok ? '✔' : '✖'} |`);
lineas.push('', `Script de fachada (\`src/components/content/Fachada.astro\`): ${jsGz} B gzip (≤ ${L.script_fachada_gzip_kb} KB) ${jsGz <= L.script_fachada_gzip_kb * 1024 ? '✔' : '✖'}.`);
lineas.push(`\`grep -REn 'url\\([^)]*\\.(png|jpe?g|webp|avif)' src/components/fanzine/ src/styles/\` → ${raster.trim() ? 'HAY RASTER ✖' : 'vacío ✔'}.`);
const salida = lineas.join('\n') + '\n';
console.log(salida);
if (md) fs.writeFileSync(path.resolve(RAIZ, md), salida);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, salida + '\n');
if (fallos.length) { console.error(`✖ ${fallos.length} fallo(s):\n  - ${fallos.join('\n  - ')}`); process.exit(1); }
console.log(`✔ ${filas.length} componentes dentro del presupuesto; script de fachada ${jsGz} B gzip; sin raster.`);
