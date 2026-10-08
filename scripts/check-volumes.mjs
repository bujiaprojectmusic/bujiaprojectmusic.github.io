#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Valida los volúmenes del fanzine (src/content/posts/**/*.mdx con
// `fanzine: true`): N pliegos con N ≥ 16 y múltiplo de 4, `n` del 1 al N
// sin repetir y en orden, y el mapa fijo de páginas (1 portada, 2 índice,
// N-1 fin, N contraportada). Corre antes de `astro build` (package.json) y
// falla con código 1 si algo no cuadra.
//
// Uso: node scripts/check-volumes.mjs [directorio-o-archivos...]
//      (sin argumentos revisa src/content/posts/ recursivamente)
// ─────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const MIN_PAGES = 16;
const args = process.argv.slice(2);
const targets = args.length ? args : [path.join('src', 'content', 'posts')];

function listMdx(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(target, e.name);
    if (e.isDirectory()) return listMdx(p);
    return e.name.endsWith('.mdx') ? [p] : [];
  });
}

function frontmatter(src) {
  return src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
}

function pliegos(src) {
  // Sin comentarios JSX ({/* ... */}) ni HTML (<!-- -->) para no contar
  // ejemplos comentados.
  const clean = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  const re = /<Pliego\b([^>]*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const attrs = m[1];
    const n = attrs.match(/\bn=\{\s*(\d+)\s*\}/) ?? attrs.match(/\bn=["'](\d+)["']/);
    const tipo = attrs.match(/\btipo=["']([a-z]+)["']/)?.[1] ?? 'normal';
    out.push({ n: n ? Number(n[1]) : NaN, tipo });
  }
  return out;
}

let failed = false;
let checked = 0;
for (const target of targets) {
  for (const file of listMdx(target)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/^fanzine:\s*true\s*$/m.test(frontmatter(src))) continue;
    checked++;
    const list = pliegos(src);
    const nums = list.map((p) => p.n);
    const N = nums.length;
    const problems = [];
    if (N < MIN_PAGES) problems.push(`tiene ${N} <Pliego>; el mínimo es ${MIN_PAGES}`);
    if (N % 4 !== 0) problems.push(`tiene ${N} <Pliego>; tiene que ser múltiplo de 4 (${MIN_PAGES}, 20, 24…)`);
    const bad = nums.filter((n) => !Number.isInteger(n) || n < 1 || n > N);
    if (bad.length) problems.push(`n fuera de rango (1–${N}) o sin n: ${bad.map((n) => (Number.isNaN(n) ? '(sin n)' : n)).join(', ')}`);
    const seen = new Set();
    const dup = nums.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    if (dup.length) problems.push(`n repetidos: ${[...new Set(dup)].join(', ')}`);
    const missing = Array.from({ length: N }, (_, i) => i + 1).filter((n) => !seen.has(n));
    if (missing.length && N) problems.push(`faltan las páginas: ${missing.join(', ')}`);
    const ordered = nums.every((n, i) => n === i + 1);
    if (!ordered && !missing.length && !dup.length) problems.push('los <Pliego> no están en orden (1, 2, 3…)');
    const tipoDe = (n) => list.find((p) => p.n === n)?.tipo;
    if (N >= MIN_PAGES && !missing.length) {
      if (tipoDe(1) !== 'portada') problems.push(`la página 1 tiene que ser tipo="portada" (es "${tipoDe(1)}")`);
      if (tipoDe(2) !== 'indice') problems.push(`la página 2 tiene que ser tipo="indice" (es "${tipoDe(2)}")`);
      if (tipoDe(N - 1) !== 'fin') problems.push(`la página ${N - 1} (N-1) tiene que ser tipo="fin" (es "${tipoDe(N - 1)}")`);
      if (tipoDe(N) !== 'contraportada') problems.push(`la página ${N} (N) tiene que ser tipo="contraportada" (es "${tipoDe(N)}")`);
    }
    if (problems.length) {
      failed = true;
      console.error(`✖ ${file}\n  - ${problems.join('\n  - ')}`);
    } else {
      console.log(`✔ ${file}: ${N} pliegos, n = 1…${N}, portada/índice/fin/contraportada en su lugar`);
    }
  }
}
if (!checked) console.log('(no hay volúmenes con fanzine: true para revisar)');
if (failed) {
  console.error('\nRevisá los <Pliego n={…}> del volumen: N páginas (≥ 16, múltiplo de 4): 1 portada, 2 índice, 3…N-2 contenido, N-1 fin, N contraportada.');
  process.exit(1);
}
