// Prueba impresa del poema en borrador (no entra a un volumen ni al manifest).
//   npx tsx scripts/print/poema-prueba.ts
// Escribe print/build/poema-prueba/poema.json y el SVG del QR.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import QRCode from 'qrcode';
import { z } from 'astro/zod';
import { piezaSchema } from '../../src/content/schemas.ts';
import { colorSchemes } from '../../src/config/site.ts';
import { ladoQrCm, urlPublicaInstagram } from '../../src/utils/poema.ts';
import { parsearMdx, leerImports, convertirHijos, type Contexto } from './lib/mdx.ts';
import { validarContenido } from './lib/validar-poema.ts';
import type { Nodo } from './lib/tipos.ts';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DIR = path.join(RAIZ, 'print', 'build', 'poema-prueba');
const piezaDir = path.join(RAIZ, 'src', 'content', 'piezas');
const esquema = piezaSchema(() => z.string());

function piezasPoema(): string[] {
  return fs.readdirSync(piezaDir).filter((ent) => {
    if (ent.startsWith('_')) return false;
    const archivo = path.join(piezaDir, ent, 'index.mdx');
    if (!fs.existsSync(archivo)) return false;
    const { data } = matter(fs.readFileSync(archivo, 'utf8'));
    return data.template === 'poema' && data.draft === true;
  });
}

const ids = piezasPoema();
if (ids.length !== 1) {
  console.error(`✖ se esperaba una pieza draft con template poema; hay ${ids.length}: ${ids.join(', ') || 'ninguna'}`);
  process.exit(1);
}
const id = ids[0];
const archivo = path.join(piezaDir, id, 'index.mdx');
const src = fs.readFileSync(archivo, 'utf8');
const { data: crudo, content } = matter(src);
const parsed = esquema.safeParse(crudo);
if (!parsed.success) {
  console.error(parsed.error.issues.map((i) => i.message).join('\n'));
  process.exit(1);
}
const data = parsed.data;
const rel = path.relative(RAIZ, archivo);
validarContenido(content, data, rel);

const tree = parsearMdx(content);
const { componentes } = leerImports(tree);
const ctx: Contexto = { archivo: rel, lineaBase: 0, componentes, datos: new Map(), paginaDeLiga: () => null, avisos: [] };
const raiz = convertirHijos(ctx, tree.children);
const pagina = raiz.find((n) => n.t === 'componente' && n.nombre === 'Pagina');
const hijos: Nodo[] = pagina && 'hijos' in pagina ? [...pagina.hijos] : [...raiz];

fs.mkdirSync(path.join(DIR, 'qr'), { recursive: true });
const qrs: { id: string; url: string; archivo: string }[] = [];
for (let i = 0; i < hijos.length; i++) {
  const n = hijos[i];
  if (n.t !== 'componente' || n.nombre !== 'VideoInstagram') continue;
  const url = urlPublicaInstagram(String(n.props.url ?? ''));
  const qid = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
  const archivoQr = path.join(DIR, 'qr', `${qid}.svg`);
  fs.writeFileSync(archivoQr, svg);
  qrs.push({ id: qid, url, archivo: '/' + path.relative(RAIZ, archivoQr).split(path.sep).join('/') });
  hijos[i] = { ...n, props: { ...n.props, url, qr: qid, lado_cm: ladoQrCm(svg) }, hijos: [] };
}

const nodos: Nodo[] = [
  { t: 'titulo_poema', v: data.titulo },
  ...hijos,
  { t: 'creditos_poema', autora: data.autor, instagram: data.instagram!, medium: data.medium!, credito_video: data.credito_video! },
];
const json = {
  vol: { esquema: data.scheme ?? 'xerox', autor: data.autor, paleta: colorSchemes, qrs },
  nodos,
};
fs.writeFileSync(path.join(DIR, 'poema.json'), JSON.stringify(json, null, 2));
console.log(`✔ ${rel} → print/build/poema-prueba/poema.json (${qrs.length} QR)`);
