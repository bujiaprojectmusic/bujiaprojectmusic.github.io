#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Valida que cada volumen del fanzine (src/content/posts/*.mdx con
// `fanzine: true`) tenga exactamente 16 <Pliego> con n del 1 al 16, sin
// repetir. Corre antes de `astro build` (ver package.json) y falla con
// código 1 si algo no cuadra.
//
// Uso: node scripts/check-volumes.mjs [directorio-o-archivos...]
//      (sin argumentos revisa src/content/posts/)
// ─────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const PAGES = 16;
const args = process.argv.slice(2);
const targets = args.length ? args : [path.join('src', 'content', 'posts')];

function listMdx(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  return fs
    .readdirSync(target)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => path.join(target, f));
}

function isFanzine(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  return /^fanzine:\s*true\s*$/m.test(m[1]);
}

function pliegoNumbers(src) {
  // Sin comentarios JSX ({/* ... */}) ni HTML (<!-- -->) para no contar
  // ejemplos comentados.
  const clean = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const nums = [];
  const re = /<Pliego\b([^>]*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const attrs = m[1];
    const n = attrs.match(/\bn=\{\s*(\d+)\s*\}/) ?? attrs.match(/\bn=["'](\d+)["']/);
    nums.push(n ? Number(n[1]) : NaN);
  }
  return nums;
}

let failed = false;
let checked = 0;
for (const target of targets) {
  for (const file of listMdx(target)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!isFanzine(src)) continue;
    checked++;
    const nums = pliegoNumbers(src);
    const problems = [];
    if (nums.length !== PAGES) problems.push(`tiene ${nums.length} <Pliego>, tienen que ser exactamente ${PAGES}`);
    const bad = nums.filter((n) => !Number.isInteger(n) || n < 1 || n > PAGES);
    if (bad.length) problems.push(`n fuera de rango o sin n: ${bad.map((n) => (Number.isNaN(n) ? '(sin n)' : n)).join(', ')}`);
    const seen = new Set();
    const dup = nums.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    if (dup.length) problems.push(`n repetidos: ${[...new Set(dup)].join(', ')}`);
    const missing = Array.from({ length: PAGES }, (_, i) => i + 1).filter((n) => !seen.has(n));
    if (missing.length && nums.length) problems.push(`faltan las páginas: ${missing.join(', ')}`);
    if (problems.length) {
      failed = true;
      console.error(`✖ ${file}\n  - ${problems.join('\n  - ')}`);
    } else {
      console.log(`✔ ${file}: 16 pliegos, n = 1…16`);
    }
  }
}
if (!checked) console.log('(no hay volúmenes con fanzine: true para revisar)');
if (failed) {
  console.error('\nRevisá los <Pliego n={…}> del volumen: cada volumen tiene 16 páginas (1 portada, 2 índice, 3–14 contenido, 15 fin, 16 contraportada).');
  process.exit(1);
}
