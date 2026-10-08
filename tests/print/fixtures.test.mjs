// Tests del motor de impresión (issue #9) con los fixtures de
// tests/print/fixtures/: desborde, tamaño mínimo, relleno a múltiplo de 4,
// volumen que no cierra, multimedia qr/omitir, foto con ppi bajo y
// componente sin gemelo. Corre: npm run print:test (node --test).
// Necesita Typst (npm run print:install) y poppler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = (n) => path.join('tests', 'print', 'fixtures', `${n}.mdx`);
const build = (n) => spawnSync('node', ['scripts/print/build.mjs', '--fixture', fixture(n), '--quiet'], { cwd: RAIZ, encoding: 'utf8' });
const resultado = (n) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'print', 'build', 'fixtures', n, 'resultado.json'), 'utf8'));
const texto = (n, variante = 'pantalla') => spawnSync('pdftotext', ['-layout', path.join(RAIZ, 'print', 'build', 'fixtures', n, `jirafa-vol-90-${variante}.pdf`), '-'], { encoding: 'utf8' }).stdout;

test('desborde: una pieza que no cabe falla nombrando la pieza y sus páginas', () => {
  const r = build('desborde');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /La pieza "Pieza 3" \(pág\. 3\) \(tests\/print\/fixtures\/desborde\.mdx:\d+\) no cabe: empieza en la pág\. 3 y termina en la pág\. 4/);
  assert.match(r.stderr, /El texto NO se achica/);
});

test('tamaño mínimo: 6 pt en un componente hace fallar el build', () => {
  const r = build('tamano-minimo');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Tamaño de letra 6 pt por debajo del mínimo 9 pt del estilo 'cuerpo_2col' \(Note\)/);
});

test('relleno: piezas sólo hasta la pág. 12 → 16 páginas con 2 de relleno antes del Fin y aviso', () => {
  const r = build('relleno-12');
  assert.equal(r.status, 0, r.stderr);
  const res = resultado('relleno-12');
  assert.equal(res.paginas, 16);
  assert.equal(res.pdfs.pantalla.paginas, 16);
  assert.deepEqual(res.mapa.filter((f) => f.tipo.startsWith('relleno')).map((f) => f.p), [13, 14]);
  assert.equal(res.avisos.filter((a) => /relleno diseñada/.test(a)).length, 2);
});

test('no cierra: piezas después del Fin → falla con mensaje claro', () => {
  const r = build('no-cierra');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no cierra/);
  assert.match(r.stderr, /el Fin está en la página 15, pero el volumen cierra en 17|17 páginas no es múltiplo de 4/);
});

test('multimedia qr: QR decodificados a la URL; ligas externas sin URL, internas "(pág. N)"', () => {
  const r = build('multimedia-qr');
  assert.equal(r.status, 0, r.stderr);
  const res = resultado('multimedia-qr');
  assert.deepEqual(res.qr.map((q) => [q.url, q.leido]), [
    ['https://www.youtube.com/watch?v=C1vfbwwdtOQ', true],
    ['https://www.youtube.com/playlist?list=PLzMaYoBMVrDm6n8BMuAVIctRy7GFBR5Ef', true],
  ]);
  const t = texto('multimedia-qr');
  assert.match(t, /Video: Guitar Set Up 101 — escanéalo/);
  assert.match(t, /Playlist: Playlist de ajuste — escanéalo/);
  assert.match(t, /Liga externa: D'Addario y liga interna a la pieza 5\s+\(pág\. 5\)/);
  assert.doesNotMatch(t, /daddario\.com|youtube\.com/);
  assert.equal(res.ligas.imprenta.links, 0);
  assert.ok(res.ligas.pantalla.links > 0);
});

test('multimedia omitir: no sale nada de los videos', () => {
  const r = build('multimedia-omitir');
  assert.equal(r.status, 0, r.stderr);
  const res = resultado('multimedia-omitir');
  assert.equal(res.multimedia, 'omitir');
  assert.equal(res.qr.length, 0);
  assert.doesNotMatch(texto('multimedia-omitir'), /escanéalo|Guitar Set Up/);
  assert.equal(res.avisos.filter((a) => /omitido/.test(a)).length, 2);
});

test('ppi bajo: una foto de 200 px a todo el ancho falla nombrando pieza y foto', () => {
  const r = build('ppi-bajo');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /La foto tests\/print\/fixtures\/foto-chica\.png en la pieza "Pieza 3" \(pág\. 3, <ImageFull>\) queda a \d+ ppi/);
});

test('componente sin gemelo: el export falla con archivo, línea y nombre', () => {
  const r = build('sin-gemelo');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /sin-gemelo\.mdx:\d+: el componente <TallerCover> \(TallerCover\.astro\) no tiene gemelo Typst/);
});
