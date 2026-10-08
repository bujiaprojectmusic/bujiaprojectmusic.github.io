// Tests de la imposición del cuadernillo (issue #10), parametrizados en N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ordenCaras, rellenarAMultiplo, imponer } from '../../scripts/print/impose.mjs';

test('orden de 16 páginas = tabla del issue', () => {
  assert.deepEqual(ordenCaras(16), [[16, 1], [2, 15], [14, 3], [4, 13], [12, 5], [6, 11], [10, 7], [8, 9]]);
});

test('orden parametrizado: 12, 20 y 24 páginas', () => {
  assert.deepEqual(ordenCaras(12), [[12, 1], [2, 11], [10, 3], [4, 9], [8, 5], [6, 7]]);
  assert.deepEqual(ordenCaras(20), [[20, 1], [2, 19], [18, 3], [4, 17], [16, 5], [6, 15], [14, 7], [8, 13], [12, 9], [10, 11]]);
  assert.equal(ordenCaras(24).length, 12);
  assert.deepEqual(ordenCaras(24)[0], [24, 1]);
  assert.deepEqual(ordenCaras(24)[11], [12, 13]);
});

test('relleno a múltiplo de 4: 12 → 12, 14 → 16, 18 → 20, blancos antes de las dos últimas', () => {
  assert.deepEqual(rellenarAMultiplo(12), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(rellenarAMultiplo(14), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null, null, 13, 14]);
  assert.deepEqual(rellenarAMultiplo(18), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, 17, 18]);
  assert.equal(ordenCaras(14).length, 8);
  assert.deepEqual(ordenCaras(14)[0], [14, 1]);
  assert.deepEqual(ordenCaras(14).flat().filter((p) => p === null).length, 2);
});

async function pdfSintetico(n) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let p = 1; p <= n; p++) {
    const page = doc.addPage([396, 612]);
    page.drawText(`P${String(p).padStart(2, '0')}`, { x: 120, y: 260, size: 72, font });
  }
  return doc.save({ useObjectStreams: false });
}

function mitades(pdf, cara) {
  const leer = (x) => execFileSync('pdftotext', ['-f', String(cara), '-l', String(cara), '-x', String(x), '-y', '0', '-W', '396', '-H', '612', pdf, '-'], { encoding: 'utf8' });
  const num = (t) => { const m = t.match(/P(\d+)/); return m ? Number(m[1]) : null; };
  return [num(leer(0)), num(leer(396))];
}

test('PDF sintético de 16 páginas: las 8 caras salen en el orden de la tabla y miden 792 × 612', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'impose-'));
  const { bytes, caras } = await imponer(await pdfSintetico(16), { caja: 'media', epoch: 0 });
  const salida = path.join(tmp, 'c.pdf');
  fs.writeFileSync(salida, bytes);
  const info = execFileSync('pdfinfo', [salida], { encoding: 'utf8' });
  assert.match(info, /Pages:\s+8/);
  assert.match(info, /Page size:\s+792 x 612 pts/);
  const leidas = caras.map((_, i) => mitades(salida, i + 1));
  assert.deepEqual(leidas, [[16, 1], [2, 15], [14, 3], [4, 13], [12, 5], [6, 11], [10, 7], [8, 9]]);
  console.log('caras leídas con pdftotext:', JSON.stringify(leidas));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('PDF sintético de 14 páginas: 16 con blancos en 13 y 14; determinista', async () => {
  const src = await pdfSintetico(14);
  const a = await imponer(src, { caja: 'media', epoch: 0 });
  const b = await imponer(src, { caja: 'media', epoch: 0 });
  assert.equal(a.total, 16);
  // Blancos en los lugares 13 y 14; Fin y contraportada pasan a los lugares 15 y 16.
  assert.deepEqual(a.caras, [[14, 1], [2, 13], [null, 3], [4, null], [12, 5], [6, 11], [10, 7], [8, 9]]);
  assert.equal(Buffer.from(a.bytes).toString('hex'), Buffer.from(b.bytes).toString('hex'));
});
