// Verso tal cual, url vacía y tamaño del QR. Corre con npm run test:content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { cuerpoDePoema, embedInstagram, ErrorPoema, ladoQrCm, urlPublicaInstagram } from '../../src/utils/poema.ts';
import { validarContenido } from '../../scripts/print/lib/validar-poema.ts';

const cuerpo = `\`\`\`poema
la lija canta bajito
en la mesa del taller

  y el verso sangrado
queda donde estaba
\`\`\`
`;

test('el cuerpo del poema conserva sangría y estrofas', () => {
  const texto = cuerpoDePoema(cuerpo);
  assert.ok(texto.includes('la lija canta bajito\nen la mesa del taller'));
  assert.ok(texto.includes('\n\n  y el verso sangrado\n'));
});

test('el verso tiene que estar tal cual en el cuerpo', () => {
  const mdx = `import VersoDestacado from '../../../components/fanzine/VersoDestacado.astro';\n\n<VersoDestacado verso="la lija canta bajito" />\n\n${cuerpo}`;
  assert.doesNotThrow(() => validarContenido(mdx, { template: 'poema' }, 'prueba.mdx'));
  assert.throws(
    () => validarContenido(mdx.replace('verso="la lija canta bajito"', 'verso="un verso que no está"'), { template: 'poema' }, 'prueba.mdx'),
    (e) => e instanceof ErrorPoema && /no aparece tal cual/.test(e.message),
  );
});

test('VideoInstagram con url vacía rompe el build', () => {
  const mdx = `<VideoInstagram url="" credito="Video: X" leyenda="un reel" />\n\n${cuerpo}`;
  assert.throws(
    () => validarContenido(mdx, { template: 'poema' }, 'prueba.mdx'),
    (e) => e instanceof ErrorPoema && /url vacía/.test(e.message),
  );
  assert.throws(() => urlPublicaInstagram('   '), (e) => e instanceof ErrorPoema && /url vacía/.test(e.message));
});

test('el embed es el oficial y no pide autoplay', () => {
  const publica = urlPublicaInstagram('https://instagram.com/reel/CpruebaJira/?utm_source=ig');
  assert.equal(publica, 'https://www.instagram.com/reel/CpruebaJira/');
  const embed = embedInstagram(publica);
  assert.equal(embed, 'https://www.instagram.com/reel/CpruebaJira/embed');
  assert.equal(embed.includes('autoplay'), false);
});

test('el QR del reel mide al menos 2.5 cm de símbolo, con zona de silencio', async () => {
  const svg = await QRCode.toString('https://www.instagram.com/reel/CpruebaJira/', {
    type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' },
  });
  const lado = ladoQrCm(svg);
  const total = Number(svg.match(/viewBox="0 0 ([\d.]+)/)[1]);
  const simboloCm = lado * (total - 8) / total;
  assert.ok(lado > 2.5, `lado ${lado}`);
  assert.ok(simboloCm >= 2.5 - 1e-6, `símbolo ${simboloCm} cm`);
  assert.match(svg, /fill="#ffffff"/);
});
