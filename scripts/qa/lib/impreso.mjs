// Impreso (comentario del 8 oct en #14): filas del QA que REUTILIZAN lo que
// ya calcula scripts/print/build.mjs + check.mjs (print/build/manifest.json)
// y scripts/print/check-reglas.mjs (npm run print:check), sin duplicar la
// lógica. Si no hay manifest, las filas salen como aviso (o error con
// requerir: true, como en CI, donde npm run print corre antes).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function revisarImpreso({ impreso = 'print/build', reglas = 'print/reglas.json', requerir = false, correrCheck = true } = {}) {
  const filas = [];
  const manifestPath = path.join(impreso, 'manifest.json');
  const fila = (nombre, estado, resumen, errores = [], avisos = []) => filas.push({ nombre, estado, resumen, errores, avisos, detalles: [] });
  if (!fs.existsSync(manifestPath)) {
    const estado = requerir ? 'error' : 'aviso';
    const msg = `no existe ${manifestPath}: corré npm run print (en CI corre antes del QA)`;
    for (const n of ['Impreso: desbordes', 'Impreso: tamaño mínimo de letra', 'Impreso: páginas', 'Impreso: ppi de las fotos', 'Impreso: gemelos Typst']) fila(n, estado, msg, requerir ? [{ archivo: manifestPath, mensaje: msg }] : [], requerir ? [] : [{ archivo: manifestPath, mensaje: msg }]);
  } else {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const R = fs.existsSync(reglas) ? JSON.parse(fs.readFileSync(reglas, 'utf8')) : null;
    const minimoPt = R ? Math.min(...Object.values(R.tipografia?.estilos ?? R.estilos ?? {}).map((e) => e.minimo_pt).filter((x) => typeof x === 'number')) : null;
    const vols = m.volumenes ?? [];
    // Desbordes e índice: build.mjs falla si una pieza no cabe; el manifest trae el mapa con ok por página.
    const malMapa = vols.flatMap((v) => (v.mapa ?? []).filter((p) => !p.ok).map((p) => ({ archivo: v.slug, mensaje: `pág. ${p.p} (${p.tipo}): folio ${p.folio} fuera de lugar` })));
    fila('Impreso: desbordes', malMapa.length ? 'error' : 'ok', vols.map((v) => `${v.slug}: ${v.paginas} págs, mapa ${(v.mapa ?? []).every((p) => p.ok) ? 'ok' : 'con errores'}`).join(' · ') || 'sin volúmenes', malMapa);
    // Tamaño mínimo de letra: tamaños medidos en el PDF vs reglas.json.
    const chicos = vols.flatMap((v) => (v.tamanos ?? []).filter((t) => minimoPt != null && t.pt < minimoPt - 0.05).map((t) => ({ archivo: v.slug, mensaje: `${t.fuente} a ${t.pt} pt (${t.usos} usos) < mínimo ${minimoPt} pt` })));
    fila('Impreso: tamaño mínimo de letra', chicos.length ? 'error' : 'ok', vols.map((v) => `${v.slug}: mínimo medido ${Math.min(...(v.tamanos ?? []).map((t) => t.pt)).toFixed(1)} pt`).join(' · ') + (minimoPt != null ? ` (regla: ≥ ${minimoPt} pt)` : ''), chicos);
    // Páginas (reglas.json → paginas): múltiplo de `multiplo` y ≥ `minimo` es error;
    // por debajo de `recomendado_min` sólo aviso. El total no tiene tope fijo (12, 16, 20, 24…).
    const P = { multiplo: R?.paginas?.multiplo ?? 4, minimo: R?.paginas?.minimo ?? 4, recomendado_min: R?.paginas?.recomendado_min ?? 12 };
    const malPag = vols.filter((v) => v.paginas < P.minimo || v.paginas % P.multiplo !== 0).map((v) => ({ archivo: v.slug, mensaje: `${v.paginas} páginas: tiene que ser múltiplo de ${P.multiplo} y ≥ ${P.minimo}` }));
    const pocasPag = vols.filter((v) => !malPag.some((e) => e.archivo === v.slug) && v.paginas < P.recomendado_min).map((v) => ({ archivo: v.slug, mensaje: `${v.paginas} páginas: menos del mínimo recomendado (${P.recomendado_min})` }));
    fila('Impreso: páginas', malPag.length ? 'error' : pocasPag.length ? 'aviso' : 'ok', vols.map((v) => `${v.slug}: ${v.paginas}`).join(' · ') + ` (regla: múltiplo de ${P.multiplo}, ≥ ${P.minimo}, recomendado ≥ ${P.recomendado_min})`, malPag, pocasPag);
    // ppi: aviso < 300, error < 150.
    const ppiErr = [];
    const ppiAv = [];
    for (const v of vols) for (const f of v.fotos ?? []) {
      if (f.ppi != null && f.ppi < 150) ppiErr.push({ archivo: v.slug, mensaje: `pliego ${f.pliego} ${f.componente}: ${f.ppi} ppi (${f.foto})` });
      else if (f.ppi != null && f.ppi < 300) ppiAv.push({ archivo: v.slug, mensaje: `pliego ${f.pliego} ${f.componente}: ${f.ppi} ppi (${f.foto})` });
    }
    fila('Impreso: ppi de las fotos', ppiErr.length ? 'error' : ppiAv.length ? 'aviso' : 'ok', vols.map((v) => `${v.slug}: mínimo ${v.ppi_min ?? '—'} ppi`).join(' · '), ppiErr, ppiAv);
    // Gemelos: el export (scripts/print/lib/mdx.ts) falla si un componente no tiene gemelo; el registro "aprobado" llega con #17.
    fila('Impreso: gemelos Typst', 'ok', `${vols.length} volúmenes exportados con gemelo para cada componente (el registro de aprobados llega con #17)`);
  }
  if (correrCheck) {
    const r = spawnSync(process.execPath, ['scripts/print/check-reglas.mjs'], { encoding: 'utf8' });
    const salida = (r.stdout + r.stderr).trim();
    fila('Impreso: reglas.json vs docs (print:check)', r.status === 0 ? 'ok' : 'error', r.status === 0 ? salida.split('\n').pop() : salida.slice(0, 300), r.status === 0 ? [] : [{ archivo: 'print/reglas.json', mensaje: salida.slice(0, 500) }]);
  }
  return filas;
}

/** Corre un fixture del impreso (p. ej. tests/print/fixtures/desborde.mdx) y devuelve { ok, salida }. */
export function fixtureImpreso(fixture) {
  const r = spawnSync(process.execPath, ['scripts/print/build.mjs', '--fixture', fixture, '--quiet'], { encoding: 'utf8' });
  return { ok: r.status === 0, salida: (r.stdout + r.stderr).trim() };
}
