// Falla el build si una pieza (aunque sea draft) tiene un verso que no está
// en el cuerpo o un <VideoInstagram> con url vacía.
//   node --import tsx scripts/check-poema.ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'astro/zod';
import { piezaSchema } from '../src/content/schemas.ts';
import { ErrorPoema } from '../src/utils/poema.ts';
import { validarContenido } from './print/lib/validar-poema.ts';

const RAIZ = process.cwd();
const dir = path.join(RAIZ, 'src', 'content', 'piezas');
const esquema = piezaSchema(() => z.string());
const errores: string[] = [];
let n = 0;

for (const ent of fs.readdirSync(dir)) {
  if (ent.startsWith('_')) continue;
  const archivo = path.join(dir, ent, 'index.mdx');
  if (!fs.existsSync(archivo)) continue;
  n++;
  const src = fs.readFileSync(archivo, 'utf8');
  const { data, content } = matter(src);
  const r = esquema.safeParse(data);
  if (!r.success) {
    errores.push(`${path.relative(RAIZ, archivo)}: frontmatter inválido:\n  - ${r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n  - ')}`);
    continue;
  }
  try {
    validarContenido(content, r.data, path.relative(RAIZ, archivo));
  } catch (e) {
    errores.push(e instanceof ErrorPoema || e instanceof Error ? e.message : String(e));
  }
}

if (errores.length) {
  console.error(`✖ poema: ${errores.length} fallo(s):\n  - ${errores.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✔ poema: ${n} pieza(s); versos y videos de Instagram revisados.`);
