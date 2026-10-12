// Volúmenes sin_listar / prueba (yml) fuera del sitemap: listVolumenesOcultos()
// de scripts/fanzine-redirects.mjs lee src/content/volumenes/*.yml (ignora los
// que empiezan con "_" y los draft). Corre con npm run test:content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listVolumenesOcultos } from '../../scripts/fanzine-redirects.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vols-'));
const w = (n, s) => fs.writeFileSync(path.join(dir, n), s);
w('_plantilla.yml', 'numero: 9\ntitulo: "p"\nsin_listar: true\n');
w('vol-01.yml', 'numero: 1\ntitulo: "a"\n# sin_listar: true (comentado)\nsin_listar: true\n');
w('vol-02.yml', 'numero: 2\ntitulo: "b"\nprueba: true\n');
w('vol-03.yml', 'numero: 3\ntitulo: "c"\nsin_listar: false\n');
w('vol-04.yml', 'numero: 4\ntitulo: "d"\nsin_listar: true\ndraft: true\n');

test('listVolumenesOcultos: sin_listar o prueba → /fanzine/vol-NN; ignora _plantilla, draft y los listados', () => {
  assert.deepEqual(listVolumenesOcultos(dir), ['/fanzine/vol-01', '/fanzine/vol-02']);
});

test('listVolumenesOcultos: el repo oculta vol-01 (sin_listar: true)', () => {
  assert.ok(listVolumenesOcultos().includes('/fanzine/vol-01'));
});
