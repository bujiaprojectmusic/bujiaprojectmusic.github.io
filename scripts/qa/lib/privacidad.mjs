// Privacidad (issue #14, alcance 4): correos y teléfonos (formatos MX) en
// src/content/piezas/**, src/content/volumenes/**, dist/fanzine/** (texto
// visible + mailto:/tel:), el JSON exportado del impreso y el texto de los
// PDF (pdftotext). Falla con archivo y línea, enmascarando el dato en el
// log. Excepciones en .github/qa/privacidad-permitidos.txt:
//   <valor> <ámbito>   ámbito = * o un prefijo de ruta/archivo (p. ej. /fanzine/colabora)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { listarHtml, rutaDe, leer, textoVisible, lineaDe, esRedireccion, decodificar } from './html.mjs';

export const RE_CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Candidatos a teléfono MX: 10 dígitos (o 12 con 52), con espacios, guiones,
// puntos o paréntesis; se confirma contando dígitos.
export const RE_TEL = /(?:\+?52[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/g;

export function esTelefono(s) {
  const d = s.replace(/\D/g, '');
  return d.length === 10 || (d.length === 12 && d.startsWith('52')) || (d.length === 11 && d.startsWith('1'));
}

export function enmascarar(valor) {
  if (valor.includes('@')) {
    const [u, dom] = valor.split('@');
    const tld = dom.slice(dom.lastIndexOf('.'));
    return `${u.slice(0, 2)}***@***${tld}`;
  }
  const d = valor.replace(/\D/g, '');
  return `${d.slice(0, 2)}** ** ${d.slice(-4)}`;
}

export function leerPermitidos(archivo = '.github/qa/privacidad-permitidos.txt') {
  if (!fs.existsSync(archivo)) return [];
  return fs
    .readFileSync(archivo, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [valor, ...resto] = l.split(/\s+/);
      return { valor, ambito: resto[0] ?? '*', digitos: valor.includes('@') ? null : valor.replace(/\D/g, '') };
    });
}

function permitido(valor, donde, permitidos) {
  const d = valor.includes('@') ? null : valor.replace(/\D/g, '');
  return permitidos.some((p) => {
    const mismo = p.digitos ? d === p.digitos : p.valor.toLowerCase() === valor.toLowerCase();
    if (!mismo) return false;
    return p.ambito === '*' || donde === p.ambito || donde.startsWith(p.ambito.replace(/\/\*\*$/, '')) ;
  });
}

/** Busca correos y teléfonos en un texto; devuelve [{ tipo, valor, indice }]. */
export function buscar(texto) {
  const out = [];
  for (const m of texto.matchAll(RE_CORREO)) out.push({ tipo: 'correo', valor: m[0], indice: m.index });
  for (const m of texto.matchAll(RE_TEL)) if (esTelefono(m[0])) out.push({ tipo: 'teléfono', valor: m[0].trim(), indice: m.index });
  return out;
}

function listarArchivos(dir, re) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (re.test(e.name)) out.push(p);
    }
  };
  rec(dir);
  return out.sort();
}

export function revisarPrivacidad({ dist, contenido = 'src/content', impreso = 'print/build', permitidos = leerPermitidos(), pdftotext = 'pdftotext' }) {
  const errores = [];
  const detalles = [];
  let revisados = 0;
  const reportar = (archivo, texto, donde, { conLinea = true } = {}) => {
    revisados++;
    for (const h of buscar(texto)) {
      if (permitido(h.valor, donde, permitidos)) continue;
      errores.push({ archivo, linea: conLinea ? lineaDe(texto, h.indice) : undefined, mensaje: `${h.tipo} en el contenido: ${enmascarar(h.valor)}` });
    }
  };
  // 1) fuentes
  for (const dir of ['piezas', 'volumenes']) {
    for (const f of listarArchivos(path.join(contenido, dir), /\.(mdx?|ya?ml)$/)) {
      reportar(path.relative(process.cwd(), f), fs.readFileSync(f, 'utf8'), path.relative(process.cwd(), f));
    }
  }
  // 2) dist/fanzine/**: texto visible + mailto:/tel:
  for (const f of listarHtml(path.join(dist, 'fanzine'))) {
    const html = leer(f);
    if (esRedireccion(html)) continue;
    const ruta = rutaDe(path.resolve(dist), path.resolve(f));
    const rel = path.relative(process.cwd(), f);
    reportar(rel, textoVisible(html), ruta, { conLinea: false });
    for (const m of html.matchAll(/href="(mailto|tel):([^"?]+)/g)) {
      const valor = decodificar(m[2]);
      if (!permitido(valor, ruta, permitidos)) errores.push({ archivo: rel, linea: lineaDe(html, m.index), mensaje: `enlace ${m[1]}: con dato de contacto: ${enmascarar(valor)}` });
    }
  }
  // 3) impreso: JSON exportado y texto de los PDF
  if (fs.existsSync(impreso)) {
    const fixturesImpreso = path.join(impreso, 'fixtures') + path.sep;
    for (const f of listarArchivos(impreso, /^volumen\.json$/)) {
      if (f.startsWith(fixturesImpreso)) continue; // print/build/fixtures/: salidas de tests del impreso
      reportar(path.relative(process.cwd(), f), fs.readFileSync(f, 'utf8'), 'impreso');
    }
    for (const f of listarArchivos(impreso, /^jirafa-vol-\d+-pantalla\.pdf$/)) {
      const r = spawnSync(pdftotext, ['-layout', f, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) {
        errores.push({ archivo: path.relative(process.cwd(), f), mensaje: `pdftotext falló: ${(r.stderr || '').trim().slice(0, 200)}` });
        continue;
      }
      const texto = r.stdout;
      revisados++;
      for (const h of buscar(texto)) {
        if (permitido(h.valor, 'impreso', permitidos)) continue;
        const pag = texto.slice(0, h.indice).split('\f').length;
        errores.push({ archivo: path.relative(process.cwd(), f), linea: undefined, mensaje: `${h.tipo} en el texto del PDF (pág. ${pag}): ${enmascarar(h.valor)}` });
      }
    }
  } else {
    detalles.push('sin print/build: no se revisaron JSON ni PDF del impreso');
  }
  detalles.unshift(`${revisados} archivos revisados, ${permitidos.length} excepciones`);
  return { nombre: 'Privacidad (correos y teléfonos)', estado: errores.length ? 'error' : 'ok', resumen: detalles.join(' · '), errores, avisos: [], detalles };
}
