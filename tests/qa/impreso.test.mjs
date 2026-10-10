// Prueba negativa del impreso (criterio 13): una pieza que se desborda hace
// fallar el QA nombrando la pieza. Reusa el fixture de #9
// (tests/print/fixtures/desborde.mdx) vía scripts/print/build.mjs --fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixtureImpreso, revisarImpreso } from '../../scripts/qa/lib/impreso.mjs';

const hayTypst = fs.existsSync('print/build/bin/typst');

test('una pieza que se desborda falla nombrando la pieza', { skip: !hayTypst && 'sin Typst (npm run print:install)' }, () => {
  const r = fixtureImpreso('tests/print/fixtures/desborde.mdx');
  assert.equal(r.ok, false);
  assert.match(r.salida, /La pieza "Pieza 3" \(pág\. 3\).*no cabe/);
});

test('sin manifest, las filas del impreso avisan (o fallan con requerir)', () => {
  const avisan = revisarImpreso({ impreso: 'tests/qa/fixtures/no-existe', correrCheck: false });
  assert.ok(avisan.every((f) => f.estado === 'aviso'));
  const fallan = revisarImpreso({ impreso: 'tests/qa/fixtures/no-existe', requerir: true, correrCheck: false });
  assert.ok(fallan.every((f) => f.estado === 'error'));
});
