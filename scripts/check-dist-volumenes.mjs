#!/usr/bin/env node
// Valida los volúmenes COMPUESTOS (src/content/volumenes/*.yml, issue #13)
// sobre el HTML ya generado en dist/fanzine/vol-NN/index.html: es la
// validación de #6 aplicada al volumen compuesto, más el índice contra el
// yml, los créditos y las fotos por astro:assets. Corre después de
// `astro build` (package.json → build) y falla con código 1. También revisa
// `sin_listar`: noindex sin franja de prueba, sin tarjeta de descarga, fuera
// de /fanzine, /volumenes y del sitemap (y lo contrario para los listados).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const RAIZ = process.cwd();
const dirVol = path.join(RAIZ, 'src', 'content', 'volumenes');
const dirPiezas = path.join(RAIZ, 'src', 'content', 'piezas');
let fallos = 0;
const mal = (m) => { fallos++; console.error(`✖ ${m}`); };

const frontmatter = (src) => yaml.load(src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '') ?? {};
const ymls = fs.existsSync(dirVol) ? fs.readdirSync(dirVol).filter((f) => /^vol-\d+\.ya?ml$/.test(f)) : [];
if (!ymls.length) { console.log('(no hay volúmenes yml que revisar)'); process.exit(0); }
if (fs.existsSync(path.join(RAIZ, 'dist', 'fanzine', '_plantilla'))) mal('dist/fanzine/_plantilla existe: la plantilla generó una ruta');
const leerSiExiste = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const listados = { '/fanzine': leerSiExiste(path.join(RAIZ, 'dist', 'fanzine', 'index.html')), '/volumenes': leerSiExiste(path.join(RAIZ, 'dist', 'volumenes', 'index.html')) };
const sitemap = fs.existsSync(path.join(RAIZ, 'dist')) ? fs.readdirSync(path.join(RAIZ, 'dist')).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map((f) => fs.readFileSync(path.join(RAIZ, 'dist', f), 'utf8')).join('\n') : '';

for (const f of ymls) {
  const v = yaml.load(fs.readFileSync(path.join(dirVol, f), 'utf8'));
  if (v.draft) continue;
  const slug = `vol-${String(v.numero).padStart(2, '0')}`;
  const html = path.join(RAIZ, 'dist', 'fanzine', slug, 'index.html');
  if (!fs.existsSync(html)) { mal(`${slug}: falta dist/fanzine/${slug}/index.html`); continue; }
  const h = fs.readFileSync(html, 'utf8');
  // Pliegos 1…N en orden, con portada/índice/fin/contraportada en su lugar.
  const pliegos = [...h.matchAll(/<section[^>]*\bid="pagina-(\d+)"[^>]*\bdata-tipo="([a-z]+)"/g)].map((m) => ({ n: Number(m[1]), tipo: m[2] }));
  const N = pliegos.length;
  const problemas = [];
  if (N < 8 || N % 4 !== 0) problemas.push(`${N} pliegos (mínimo 8, múltiplo de 4)`);
  if (!pliegos.every((p, i) => p.n === i + 1)) problemas.push(`numeración: ${pliegos.map((p) => p.n).join(', ')}`);
  const tipo = (n) => pliegos.find((p) => p.n === n)?.tipo;
  if (tipo(1) !== 'portada') problemas.push('pág. 1 no es portada');
  if (tipo(2) !== 'indice') problemas.push('pág. 2 no es índice');
  if (tipo(N - 1) !== 'fin') problemas.push(`pág. ${N - 1} no es fin`);
  if (tipo(N) !== 'contraportada') problemas.push(`pág. ${N} no es contraportada`);
  // Índice generado = yml (orden, título, autor, página) y anclas.
  const piezas = (v.piezas ?? []).filter((e) => e.pieza).sort((a, b) => a.desde - b.desde);
  // Astro escapa el texto (&quot; &#39; &amp;…): se decodifica para comparar con el yml.
  const decodificar = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#38;|&amp;/g, '&');
  const items = [...h.matchAll(/<a href="#pagina-(\d+)" class="fz-indice__link[^"]*"[^>]*>\s*<span class="fz-indice__page[^"]*"[^>]*>(\d+)<\/span>\s*<span[^>]*><\/span>\s*<span class="fz-indice__item-title[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => ({ ancla: Number(m[1]), pagina: Number(m[2]), titulo: decodificar(m[3].trim()) }));
  const esperado = piezas.map((e) => {
    const fm = frontmatter(fs.readFileSync(path.join(dirPiezas, e.pieza, 'index.mdx'), 'utf8'));
    return { pagina: e.desde, titulo: `${fm.titulo} — ${fm.autor}`, credito: fm.credito, fotos: fm.fotos ?? [] };
  });
  const indiceOk = items.length === esperado.length && items.every((it, i) => it.pagina === esperado[i].pagina && it.ancla === esperado[i].pagina && it.titulo === esperado[i].titulo && h.includes(`id="pagina-${it.ancla}"`));
  if (!indiceOk) problemas.push(`índice ≠ yml: HTML ${JSON.stringify(items)} vs yml ${JSON.stringify(esperado.map((e) => ({ pagina: e.pagina, titulo: e.titulo })))}`);
  // Créditos de cada pieza y pie + crédito de cada foto.
  for (const e of esperado) {
    const hd = decodificar(h);
    if (!hd.includes(e.credito)) problemas.push(`falta el crédito "${e.credito}" en el HTML`);
    for (const foto of e.fotos) {
      if (!hd.includes(`Foto: ${foto.credito}`)) problemas.push(`falta el crédito de foto "${foto.credito}"`);
      if (foto.pie && !hd.includes(foto.pie)) problemas.push(`falta el pie de foto "${foto.pie}"`);
    }
  }
  // Fotos por astro:assets: ningún src crudo a src/assets/piezas.
  const crudas = [...h.matchAll(/src="([^"]*src\/assets\/piezas[^"]*)"/g)].map((m) => m[1]);
  if (crudas.length) problemas.push(`fotos sin optimizar: ${crudas.join(', ')}`);
  // sin_listar / prueba: publicado pero fuera de listados, sitemap y descarga; noindex.
  const oculto = !!v.sin_listar || !!v.prueba;
  const noindex = /<meta name="robots" content="noindex,nofollow">/.test(h);
  const banner = /<p class="fz-prueba-banner/.test(h); // el elemento, no su CSS
  const descarga = /class="fz-lleva\b/.test(h);
  const enlazado = Object.entries(listados).filter(([, html]) => new RegExp(`href="(?:https?://[^"/]+)?/fanzine/${slug}"`).test(html)).map(([p]) => p);
  const enSitemap = sitemap.includes(`/fanzine/${slug}<`) || sitemap.includes(`/fanzine/${slug}/<`);
  if (oculto) {
    if (!noindex) problemas.push(`${v.sin_listar ? 'sin_listar' : 'prueba'}: falta <meta name="robots" content="noindex,nofollow">`);
    if (v.sin_listar && !v.prueba && banner) problemas.push('sin_listar: trae la franja "EDICIÓN DE PRUEBA" y no es prueba');
    if (v.sin_listar && descarga) problemas.push('sin_listar: trae la tarjeta de descarga de PDF (.fz-lleva)');
    if (enlazado.length) problemas.push(`${v.sin_listar ? 'sin_listar' : 'prueba'}: aparece enlazado en ${enlazado.join(' y ')}`);
    if (enSitemap) problemas.push(`${v.sin_listar ? 'sin_listar' : 'prueba'}: aparece en el sitemap`);
  } else {
    if (noindex) problemas.push('volumen listado con noindex');
    if (enlazado.length < 2) problemas.push(`no aparece enlazado en ${Object.keys(listados).filter((p) => !enlazado.includes(p)).join(' ni ')}`);
    if (sitemap && !enSitemap) problemas.push('no aparece en el sitemap');
  }
  if (problemas.length) mal(`${slug}:\n  - ${problemas.join('\n  - ')}`);
  else if (oculto) console.log(`✔ dist/fanzine/${slug}: ${N} pliegos, índice = yml, créditos y fotos ok · ${v.sin_listar ? 'sin_listar' : 'prueba'}: noindex${v.sin_listar && !v.prueba ? ' sin franja de prueba' : ''}, ${v.sin_listar ? 'sin tarjeta de descarga, ' : ''}no enlazado en /fanzine ni /volumenes, fuera del sitemap`);
  else console.log(`✔ dist/fanzine/${slug}: ${N} pliegos (1 portada, 2 índice, ${N - 1} fin, ${N} contraportada), índice = yml (${items.map((i) => `${i.pagina} ${i.titulo}`).join('; ')}), créditos y fotos ok`);
}
process.exit(fallos ? 1 : 0);
