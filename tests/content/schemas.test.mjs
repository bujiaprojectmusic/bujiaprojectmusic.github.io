// Tests de los esquemas y la composición del fanzine (issue #13).
// Corre: npm run test:content  (node --import tsx --test …)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import { piezaSchema, volumenSchema } from '../../src/content/schemas.ts';
import { componer, ErrorComposicion } from '../../src/utils/componer.ts';

const image = () => z.string();
const reference = () => z.string();
const pieza = piezaSchema(image);
const volumen = volumenSchema(image, reference);
const base = { titulo: 'Caso', seccion: 'cronica-de-taller', autor: 'Nadie', credito: 'Texto: Nadie', consentimiento_ref: '2026-10-caso#correo-2026-10-03', paginas: 1 };
const mensajes = (r) => r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`);

test('pieza válida pasa y rellena defaults', () => {
  const r = pieza.safeParse(base);
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(r.data.licencia, 'permiso-no-exclusivo');
  assert.deepEqual(r.data.fotos, []);
  assert.equal(r.data.draft, false);
});

for (const [nombre, datos, esperado] of [
  ['sin credito', (() => { const { credito, ...d } = base; return d; })(), /^credito: Required/],
  ['sin consentimiento_ref', (() => { const { consentimiento_ref, ...d } = base; return d; })(), /^consentimiento_ref: Required/],
  ['foto sin alt', { ...base, fotos: [{ src: '/piezas/x/01.jpg', pie: 'x', credito: 'x', personas_identificables: false }] }, /^fotos\.0\.alt: Required/],
  ['seccion fuera del enum', { ...base, seccion: 'chisme' }, /^seccion: Invalid enum value/],
  ['clave extra (contacto)', { ...base, contacto: 'persona@correo.com' }, /^\(raíz\): Unrecognized key\(s\) in object: 'contacto'/],
  ['consentimiento_ref correo', { ...base, consentimiento_ref: 'persona@correo.com' }, /no puede ser un correo/],
  ['consentimiento_ref teléfono', { ...base, consentimiento_ref: '5512345678' }, /no puede ser un teléfono/],
]) {
  test(`pieza inválida: ${nombre} rompe con mensaje claro`, () => {
    const r = pieza.safeParse(datos);
    assert.equal(r.success, false);
    const m = mensajes(r);
    assert.ok(m.some((x) => esperado.test(x)), `mensajes: ${m.join(' | ')}`);
    console.log(`  ${nombre} → ${m.join(' | ')}`);
  });
}

test('volumen: clave extra y desde < 3 rompen', () => {
  const v = { numero: 2, titulo: 'x', fecha: '2026-11-01', publishDate: '2026-11-15', portada: { alt: '' }, piezas: [{ pieza: 'a', desde: 3 }] };
  assert.ok(volumen.safeParse(v).success);
  assert.equal(volumen.safeParse({ ...v, contacto: 'x' }).success, false);
  assert.equal(volumen.safeParse({ ...v, piezas: [{ pieza: 'a', desde: 2 }] }).success, false);
  assert.equal(volumen.safeParse({ ...v, paginas_minimo: 18 }).success, false);
});

const P = (id, paginas, draft = false) => ({ id, titulo: id, autor: 'A', paginas, draft });

test('composición: hueco → aviso + relleno, N múltiplo de 4', () => {
  const c = componer('vol-98', [{ pieza: P('a', 1), desde: 3 }, { pieza: P('b', 1), desde: 6 }]);
  assert.equal(c.N, 8);
  assert.deepEqual(c.paginas.map((p) => `${p.n}:${p.tipo}${p.tipo === 'relleno' ? '(' + p.relleno + ')' : ''}`), ['1:portada', '2:indice', '3:pieza', '4:relleno(colabora)', '5:relleno(notas)', '6:pieza', '7:fin', '8:contraportada']);
  assert.equal(c.avisos.length, 2);
  console.log('  ' + c.avisos.join('\n  '));
});

test('composición: traslape, pieza draft y pieza repetida son error', () => {
  assert.throws(() => componer('vol-98', [{ pieza: P('a', 2), desde: 3 }, { pieza: P('b', 1), desde: 4 }]), (e) => e instanceof ErrorComposicion && /traslape en la pág\. 4/.test(e.message) && (console.log('  ' + e.message.split('\n').join(' ')), true));
  assert.throws(() => componer('vol-98', [{ pieza: P('a', 1, true), desde: 3 }]), (e) => /es draft/.test(e.message) && (console.log('  ' + e.message.split('\n').join(' ')), true));
  const uso = new Map();
  componer('vol-01', [{ pieza: P('a', 1), desde: 3 }], uso);
  assert.throws(() => componer('vol-02', [{ pieza: P('a', 1), desde: 3 }], uso), /ya está en vol-01/);
});

test('composición: N crece con las piezas (no hay tope de 16) y paginas_minimo rellena', () => {
  const c = componer('vol-98', [{ pieza: P('a', 12), desde: 3 }, { pieza: P('b', 3), desde: 15 }]);
  assert.equal(c.N, 20);
  assert.equal(c.paginas.find((p) => p.tipo === 'fin').n, 19);
  const m = componer('vol-98', [{ pieza: P('a', 1), desde: 3 }], undefined, 16);
  assert.equal(m.N, 16);
  assert.equal(m.paginas.filter((p) => p.tipo === 'relleno').length, 11);
});

test('composición: relleno declarado en el yml no da aviso y ocupa su página', () => {
  const c = componer('vol-98', [{ pieza: P('a', 1), desde: 3 }, { relleno: 'taller', desde: 4 }]);
  assert.equal(c.N, 8);
  assert.deepEqual(c.paginas[3], { n: 4, tipo: 'relleno', relleno: 'taller', declarado: true });
  assert.equal(c.avisos.filter((a) => /pág\. 4/.test(a)).length, 0);
});
