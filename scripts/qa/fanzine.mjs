#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// QA del fanzine (issue #14): npm run qa:fanzine
//
// Corre sobre dist/ (npm run build) y print/build/ (npm run print):
//   1. enlaces internos y anclas (fallan) · externos (aviso, con reintentos)
//   2. índice ↔ pliegos por volumen y lista de volúmenes
//   3. metadatos y créditos (crédito de pieza, alt, crédito de fotos y portada,
//      licencia y consentimiento_ref)
//   4. privacidad: correos y teléfonos en fuentes, dist/fanzine, JSON y PDF
//   5. accesibilidad con axe (390 y 1280 px): serious/critical fallan
//   6. impreso: filas que reutilizan print/build/manifest.json y print:check
// Resumen en consola y en $GITHUB_STEP_SUMMARY; informe completo en
// qa-fanzine-report/ (informe.md + informe.json). Sale con 1 si hay ❌.
//
// Uso: node scripts/qa/fanzine.mjs [--dist dist] [--contenido src/content]
//      [--impreso print/build] [--salida qa-fanzine-report] [--sitio https://…]
//      [--sin-externos] [--sin-axe] [--sin-impreso] [--requerir-impreso]
// Excepciones: .github/qa/enlaces-ignorar.txt, .github/qa/privacidad-permitidos.txt
// ─────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { revisarEnlaces } from './lib/enlaces.mjs';
import { revisarIndice } from './lib/indice.mjs';
import { revisarCreditos } from './lib/creditos.mjs';
import { revisarPrivacidad } from './lib/privacidad.mjs';
import { revisarAccesibilidad } from './lib/axe.mjs';
import { revisarImpreso } from './lib/impreso.mjs';

const t0 = Date.now();
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (k) => args.includes(k);
const DIST = opt('--dist', 'dist');
const CONTENIDO = opt('--contenido', 'src/content');
const IMPRESO = opt('--impreso', 'print/build');
const SALIDA = opt('--salida', 'qa-fanzine-report');
const SITIO = opt('--sitio', 'https://bujiaprojectmusic.com');
const enCI = !!process.env.GITHUB_ACTIONS;

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`No existe ${DIST}/index.html: corré npm run build primero.`);
  process.exit(2);
}

const ICONO = { ok: '✅', error: '❌', aviso: '⚠️', info: 'ℹ️' };
const filas = [];
const correr = async (nombre, fn) => {
  process.stdout.write(`→ ${nombre} … `);
  try {
    const r = await fn();
    const lista = Array.isArray(r) ? r : [r];
    for (const f of lista) {
      filas.push(f);
    }
    const peor = lista.some((f) => f.estado === 'error') ? 'error' : lista.some((f) => f.estado === 'aviso') ? 'aviso' : 'ok';
    process.stdout.write(`${ICONO[peor]}\n`);
  } catch (e) {
    filas.push({ nombre, estado: 'error', resumen: `el chequeo falló: ${e.message}`, errores: [{ archivo: '-', mensaje: e.stack ?? String(e) }], avisos: [] });
    process.stdout.write('❌ (excepción)\n');
  }
};

await correr('Enlaces y anclas', () => revisarEnlaces({ dist: DIST, sitio: SITIO, externos: !flag('--sin-externos') }));
await correr('Índice ↔ pliegos', () => revisarIndice({ dist: DIST, contenido: CONTENIDO }));
await correr('Metadatos y créditos', () => revisarCreditos({ dist: DIST, contenido: CONTENIDO }));
await correr('Privacidad', () => revisarPrivacidad({ dist: DIST, contenido: CONTENIDO, impreso: IMPRESO }));
if (!flag('--sin-axe')) await correr('Accesibilidad (axe)', () => revisarAccesibilidad({ dist: DIST, contenido: CONTENIDO }));
if (!flag('--sin-impreso')) await correr('Impreso', () => revisarImpreso({ impreso: IMPRESO, requerir: flag('--requerir-impreso') || enCI }));

// ── Resumen ──────────────────────────────────────────────────────────────
const seg = ((Date.now() - t0) / 1000).toFixed(1);
const md = [];
md.push(`## QA del fanzine (npm run qa:fanzine) — ${seg} s`);
md.push('');
md.push('| Chequeo | Estado | Resumen | Errores | Avisos |');
md.push('|---|:-:|---|---:|---:|');
for (const f of filas) md.push(`| ${f.nombre} | ${ICONO[f.estado]} | ${f.resumen.replace(/\|/g, '\\|')} | ${f.errores.length} | ${f.avisos.length} |`);
md.push('');
const donde = (e) => `\`${e.archivo}${e.linea ? `:${e.linea}` : ''}\`${e.selector ? ` (${e.selector})` : ''}`;
for (const f of filas) {
  if (!f.errores.length && !f.avisos.length) continue;
  md.push(`### ${ICONO[f.estado]} ${f.nombre}`);
  md.push('');
  for (const e of f.errores) md.push(`- ❌ ${donde(e)}: ${e.mensaje}`);
  for (const a of f.avisos) md.push(`- ⚠️ ${donde(a)}: ${a.mensaje}`);
  md.push('');
}
const detalles = filas.filter((f) => f.detalles?.length);
if (detalles.length) {
  md.push('<details><summary>Detalles</summary>');
  md.push('');
  for (const f of detalles) {
    md.push(`**${f.nombre}**`);
    md.push('');
    for (const d of f.detalles) md.push(`- ${d}`);
    md.push('');
  }
  md.push('</details>');
  md.push('');
}
const texto = md.join('\n') + '\n';
console.log('\n' + texto);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto);
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, 'informe.md'), texto);
fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify({ generado: new Date().toISOString(), segundos: Number(seg), dist: DIST, filas }, null, 2));

const errores = filas.reduce((n, f) => n + f.errores.length, 0);
const avisos = filas.reduce((n, f) => n + f.avisos.length, 0);
for (const f of filas) for (const e of f.errores) console.error(`❌ ${f.nombre} · ${e.archivo}${e.linea ? `:${e.linea}` : ''}${e.selector ? ` (${e.selector})` : ''}: ${e.mensaje}`);
if (errores) {
  console.error(`\n✖ QA del fanzine: ${errores} error(es), ${avisos} aviso(s). Informe en ${SALIDA}/informe.md`);
  process.exit(1);
}
console.log(`✔ QA del fanzine: sin errores, ${avisos} aviso(s) (${seg} s). Informe en ${SALIDA}/informe.md`);
