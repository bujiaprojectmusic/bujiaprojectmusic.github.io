// Pruebas negativas del chequeo de enlaces (issue #14, criterios 2 y 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarEnlaces } from '../../scripts/qa/lib/enlaces.mjs';

const dist = 'tests/qa/fixtures/enlaces/dist';

test('un enlace interno roto y un #ancla inexistente fallan (con archivo y línea)', async () => {
  const r = await revisarEnlaces({ dist, externos: false, ignorar: [] });
  assert.equal(r.estado, 'error');
  const msgs = r.errores.map((e) => `${e.archivo}:${e.linea} ${e.mensaje}`);
  assert.ok(msgs.some((m) => /dist\/index\.html:\d+ enlace interno roto: a → "\/no-existe"/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => /ancla inexistente: "#pagina-99"/.test(m)), msgs.join('\n'));
  assert.equal(r.errores.length, 2, 'sólo esos dos: /fanzine y #pagina-1 están bien');
});

test('un enlace externo caído sale como aviso y no es error', async () => {
  const r = await revisarEnlaces({ dist, externos: true, ignorar: [], reintentos: 1, timeoutMs: 2000 });
  assert.equal(r.errores.length, 2, 'los internos siguen siendo los mismos 2 errores');
  assert.ok(r.avisos.some((a) => a.mensaje.includes('http://127.0.0.1:9/caido')), JSON.stringify(r.avisos));
  const soloExternos = r.avisos.filter((a) => a.mensaje.includes('externo'));
  assert.equal(soloExternos.length, 1);
});

test('la lista de ignorados calla un externo', async () => {
  const r = await revisarEnlaces({ dist, externos: true, ignorar: ['http://127.0.0.1:9/*'], reintentos: 0, timeoutMs: 1000 });
  assert.equal(r.avisos.length, 0);
});
