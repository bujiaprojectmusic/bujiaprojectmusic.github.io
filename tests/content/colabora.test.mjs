// Tests de la página de envío de colaboraciones (issue #12).
// Corre: npm run test:content  (node --import tsx --test …)
// - El mailto: se arma desde la única constante de src/config/colabora.ts.
// - Si existe dist/fanzine/colabora/enviar/index.html (tras npm run build),
//   el href del botón decodificado da exactamente destinatario, asunto y
//   cuerpo; mide ≤ 2000; el <pre> trae la misma plantilla; privacidad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CORREO, ASUNTO, PLANTILLA, mailtoColabora } from '../../src/config/colabora.ts';
import { fanzine } from '../../src/config/site.ts';

const href = mailtoColabora();
const partes = () => {
  const m = href.match(/^mailto:([^?]+)\?subject=([^&]*)&body=(.*)$/);
  assert.ok(m, 'forma mailto:to?subject=…&body=…');
  return { para: m[1], asunto: decodeURIComponent(m[2]), cuerpo: decodeURIComponent(m[3]) };
};

test('mailto: destinatario, asunto y cuerpo salen de la constante', () => {
  const p = partes();
  assert.equal(p.para, 'bujiaprojectmusic+fanzine@gmail.com');
  assert.equal(p.para, CORREO);
  assert.equal(p.asunto, ASUNTO);
  assert.equal(p.asunto, '[Jirafa] <título de tu pieza>');
  assert.equal(p.cuerpo.replace(/\r\n/g, '\n'), PLANTILLA);
  assert.ok(href.includes('%0D%0A'), 'saltos de línea como %0D%0A (RFC 6068)');
  assert.ok(!/[\n\r ]/.test(href), 'sin saltos ni espacios sin codificar');
});

test('mailto: mide ≤ 2000 caracteres', () => {
  assert.ok(href.length <= 2000, `href mide ${href.length}`);
});

const html = fs.existsSync('dist/fanzine/colabora/enviar/index.html') ? fs.readFileSync('dist/fanzine/colabora/enviar/index.html', 'utf8') : null;
const desc = (s) => s.replace(/&amp;|&#38;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

test('dist: el href del botón es el mismo mailto y el <pre> trae la plantilla', { skip: !html && 'sin dist/ (npm run build)' }, () => {
  const hrefs = [...html.matchAll(/href="(mailto:[^"]+)"/g)].map((m) => desc(m[1]));
  const botones = hrefs.filter((h) => h.includes('subject='));
  assert.ok(botones.length >= 1, 'hay botón mailto con subject');
  for (const h of botones) assert.equal(h, href);
  const pre = html.match(/<pre[^>]*id="plantilla-texto"[^>]*>([\s\S]*?)<\/pre>/);
  assert.ok(pre, 'hay <pre id="plantilla-texto">');
  assert.equal(desc(pre[1]), PLANTILLA);
});

test('dist: privacidad — único correo y ningún teléfono', { skip: !html && 'sin dist/' }, () => {
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const correos = [...new Set((texto + ' ' + html).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
  assert.deepEqual(correos, ['bujiaprojectmusic+fanzine@gmail.com']);
  const tel = texto.match(/(\+?52)?[ -]?\(?[0-9]{2,3}\)?[ -]?[0-9]{3,4}[ -]?[0-9]{4}/g);
  assert.equal(tel, null, `teléfonos: ${tel}`);
});

test('dist: interruptor de publicación', { skip: !html && 'sin dist/' }, () => {
  const noindex = /name="robots" content="noindex/.test(html);
  const aviso = html.includes('Borrador – pendiente de revisión legal');
  const sitemap = fs.existsSync('dist/sitemap-0.xml') ? fs.readFileSync('dist/sitemap-0.xml', 'utf8') : '';
  if (fanzine.colabora.publicada) {
    assert.equal(noindex, false);
    assert.equal(aviso, false);
    assert.ok(sitemap.includes('/fanzine/colabora/enviar'), 'en el sitemap');
  } else {
    assert.equal(noindex, true);
    assert.equal(aviso, true);
    assert.ok(!sitemap.includes('/fanzine/colabora/enviar'), 'fuera del sitemap');
  }
});
