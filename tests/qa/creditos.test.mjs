// Pruebas negativas de metadatos y créditos (criterio 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarCreditos } from '../../scripts/qa/lib/creditos.mjs';

test('pieza sin crédito visible, foto sin alt / alt="" sin marcar, foto sin crédito y portada sin crédito fallan', () => {
  const r = revisarCreditos({ dist: 'tests/qa/fixtures/creditos/dist', contenido: 'tests/qa/fixtures/creditos/contenido' });
  assert.equal(r.estado, 'error');
  const m = r.errores.map((e) => `${e.archivo}${e.linea ? ':' + e.linea : ''} ${e.mensaje}`);
  assert.ok(m.some((x) => x.includes('<img> sin atributo alt')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('<img alt=""> sin marcar como decorativa')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('no muestra su crédito "Texto y fotos: Ripper"')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('la foto "Mesa de trabajo" (cronica) se pinta sin su crédito visible "Foto: Ripper"')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('la portada de vol-02 tiene imagen pero no muestra crédito')), m.join('\n'));
});
