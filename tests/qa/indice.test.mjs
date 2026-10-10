// Pruebas negativas del chequeo índice ↔ pliegos y lista de volúmenes (criterios 4 y 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarIndice } from '../../scripts/qa/lib/indice.mjs';

test('número de página y título equivocados, pieza ausente y relleno en el índice fallan', () => {
  const r = revisarIndice({ dist: 'tests/qa/fixtures/indice/dist', contenido: 'tests/qa/fixtures/indice/contenido' });
  assert.equal(r.estado, 'error');
  const m = r.errores.map((e) => e.mensaje);
  assert.ok(m.some((x) => x.includes('número impreso en el índice ("05") no coincide con su posición (#pagina-4)')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('"Taller: otro título — Ripper" ≠ "Taller: rebobinado — Ripper"')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('la pieza "ausente" (desde: 6')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('#pagina-7, que es una página de relleno')), m.join('\n'));
  assert.ok(r.errores.every((e) => e.archivo), 'cada error trae archivo');
});

test('un volumen publicado que no aparece en /volumenes falla (y /fanzine pasa)', () => {
  const r = revisarIndice({ dist: 'tests/qa/fixtures/indice/dist', contenido: 'tests/qa/fixtures/indice/contenido' });
  const m = r.errores.map((e) => `${e.archivo}: ${e.mensaje}`);
  assert.ok(m.some((x) => x.includes('dist/volumenes/index.html') && x.includes('vol-01') && x.includes('no aparece enlazado en /volumenes')), m.join('\n'));
  assert.ok(!m.some((x) => x.includes('no aparece enlazado en /fanzine')), m.join('\n'));
});

test('un volumen limpio pasa', () => {
  const r = revisarIndice({ dist: 'tests/qa/fixtures/limpio/dist', contenido: 'tests/qa/fixtures/limpio/contenido' });
  // vol-04 no tiene índice ni /volumenes en el fixture: errores esperables, pero ninguno de título/página.
  assert.ok(r.errores.every((e) => /no tiene índice|no existe \/|no aparece enlazado/.test(e.mensaje)), r.errores.map((e) => e.mensaje).join('\n'));
});
