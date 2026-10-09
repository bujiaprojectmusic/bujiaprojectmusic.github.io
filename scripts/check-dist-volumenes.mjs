#!/usr/bin/env node
// Valida los volúmenes COMPUESTOS (src/content/volumenes/*.yml, issue #13)
// sobre el HTML ya generado en dist/fanzine/vol-NN/index.html: es la
// validación de #6 aplicada al volumen compuesto, más el índice contra el
// yml, los créditos y las fotos por astro:assets. Corre después de
// `astro build` (package.json → build) y falla con código 1.
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
  const items = [...h.matchAll(/<a href="#pagina-(\d+)" class="fz-indice__link[^"]*"[^>]*>\s*<span class="fz-indice__page[^"]*"[^>]*>(\d+)<\/span>\s*<span[^>]*><\/span>\s*<span class="fz-indice__item-title[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => ({ ancla: Number(m[1]), pagina: Number(m[2]), titulo: m[3].trim() }));
  const esperado = piezas.map((e) => {
    const fm = frontmatter(fs.readFileSync(path.join(dirPiezas, e.pieza, 'index.mdx'), 'utf8'));
    return { pagina: e.desde, titulo: `${fm.titulo} — ${fm.autor}`, credito: fm.credito, fotos: fm.fotos ?? [] };
  });
  const indiceOk = items.length === esperado.length && items.every((it, i) => it.pagina === esperado[i].pagina && it.ancla === esperado[i].pagina && it.titulo === esperado[i].titulo && h.includes(`id="pagina-${it.ancla}"`));
  if (!indiceOk) problemas.push(`índice ≠ yml: HTML ${JSON.stringify(items)} vs yml ${JSON.stringify(esperado.map((e) => ({ pagina: e.pagina, titulo: e.titulo })))}`);
  // Créditos de cada pieza y pie + crédito de cada foto.
  for (const e of esperado) {
    if (!h.includes(e.credito.replace(/&/g, '&amp;'))) problemas.push(`falta el crédito "${e.credito}" en el HTML`);
    for (const foto of e.fotos) {
      if (!h.includes(`Foto: ${foto.credito}`)) problemas.push(`falta el crédito de foto "${foto.credito}"`);
      if (foto.pie && !h.includes(foto.pie.replace(/&/g, '&amp;'))) problemas.push(`falta el pie de foto "${foto.pie}"`);
    }
  }
  // Fotos por astro:assets: ningún src crudo a src/assets/piezas.
  const crudas = [...h.matchAll(/src="([^"]*src\/assets\/piezas[^"]*)"/g)].map((m) => m[1]);
  if (crudas.length) problemas.push(`fotos sin optimizar: ${crudas.join(', ')}`);
  if (problemas.length) mal(`${slug}:\n  - ${problemas.join('\n  - ')}`);
  else console.log(`✔ dist/fanzine/${slug}: ${N} pliegos (1 portada, 2 índice, ${N - 1} fin, ${N} contraportada), índice = yml (${items.map((i) => `${i.pagina} ${i.titulo}`).join('; ')}), créditos y fotos ok`);
}
process.exit(fallos ? 1 : 0);
