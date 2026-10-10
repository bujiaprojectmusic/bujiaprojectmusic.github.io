// Prueba negativa de accesibilidad (criterio 9): contraste insuficiente = serious.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarAccesibilidad } from '../../scripts/qa/lib/axe.mjs';

test('una violación serious (contraste) falla; una página con contraste pasa', async () => {
  const r = await revisarAccesibilidad({ dist: 'tests/qa/fixtures/axe/dist', rutas: ['/', '/bien'], anchos: [390] });
  assert.equal(r.estado, 'error');
  assert.ok(r.errores.some((e) => e.archivo === '/ @ 390px' && e.mensaje.includes('[serious] color-contrast')), JSON.stringify(r.errores));
  assert.ok(!r.errores.some((e) => e.archivo.startsWith('/bien')), JSON.stringify(r.errores));
});
