// Pruebas negativas de privacidad (criterios 7, 8 y 13): correos y teléfonos en
// piezas, en dist/fanzine/**, en el JSON del impreso y en el texto de un PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { revisarPrivacidad, enmascarar, buscar, leerPermitidos } from '../../scripts/qa/lib/privacidad.mjs';

const F = 'tests/qa/fixtures/privacidad';
const permitidos = leerPermitidos('.github/qa/privacidad-permitidos.txt');
const hayPdftotext = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).status != null;

test('enmascara correos y teléfonos en el log', () => {
  assert.equal(enmascarar('pepe.perez@ejemplo.com'), 'pe***@***.com');
  assert.equal(enmascarar('+52 (55) 9876-5432'), '52** ** 5432');
  assert.deepEqual(buscar('nada que ver 2026-08-01 ni 12345').map((h) => h.valor), []);
});

test('correo y teléfono en una pieza, teléfono en dist/fanzine y en el JSON del impreso fallan, enmascarados', () => {
  const r = revisarPrivacidad({ dist: `${F}/dist`, contenido: `${F}/contenido`, impreso: `${F}/impreso`, permitidos });
  assert.equal(r.estado, 'error');
  const m = r.errores.map((e) => `${e.archivo}${e.linea ? ':' + e.linea : ''} ${e.mensaje}`);
  assert.ok(m.some((x) => x.includes('piezas/entrevista/index.mdx:9 correo en el contenido: pe***@***.com')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('piezas/entrevista/index.mdx:9 teléfono en el contenido: 55** ** 5678')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('dist/fanzine/vol-03/index.html teléfono en el contenido: 52** ** 5432')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('vol-03/index.html') && x.includes('enlace tel: con dato de contacto: 55** ** 5432')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('impreso/vol-03/volumen.json:1 teléfono en el contenido: 55** ** 5678')), m.join('\n'));
  assert.ok(!m.some((x) => x.includes('pepe.perez') || x.includes('98765432') || x.includes('1234 5678')), 'el log no muestra el dato completo');
});

test('el correo de colaboración en /fanzine/colabora no falla; el mismo correo en una pieza sí', () => {
  const r = revisarPrivacidad({ dist: `${F}/dist`, contenido: `${F}/contenido`, impreso: `${F}/impreso`, permitidos });
  const m = r.errores.map((e) => `${e.archivo} ${e.mensaje}`);
  assert.ok(!m.some((x) => x.includes('colabora/index.html')), m.join('\n'));
  assert.ok(m.some((x) => x.includes('piezas/con-correo-colabora/index.mdx') && x.includes('bu***@***.com')), m.join('\n'));
});

test('un correo en el texto de un PDF del impreso falla', { skip: !hayPdftotext && 'sin pdftotext' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-pdf-'));
  const dir = path.join(tmp, 'vol-09');
  fs.mkdirSync(dir);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([396, 612]);
  page.drawText('Escribele a juan.perez@ejemplo.com', { x: 40, y: 500, size: 12, font });
  fs.writeFileSync(path.join(dir, 'jirafa-vol-09-pantalla.pdf'), await pdf.save());
  const r = revisarPrivacidad({ dist: `${F}/dist`, contenido: 'tests/qa/fixtures/limpio/contenido', impreso: tmp, permitidos });
  const m = r.errores.map((e) => `${e.archivo} ${e.mensaje}`);
  assert.ok(m.some((x) => x.includes('jirafa-vol-09-pantalla.pdf') && x.includes('correo en el texto del PDF (pág. 1): ju***@***.com')), m.join('\n'));
  fs.rmSync(tmp, { recursive: true, force: true });
});
