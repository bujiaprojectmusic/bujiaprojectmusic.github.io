// Utilidades mínimas para leer el HTML generado en dist/ (issue #14). Sin
// parser completo: expresiones regulares cuidadosas sobre el HTML de Astro.
import fs from 'node:fs';
import path from 'node:path';

export function listarHtml(dir) {
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  if (fs.existsSync(dir)) rec(dir);
  return out.sort();
}

/** Ruta pública de un archivo de dist: dist/fanzine/vol-01/index.html → /fanzine/vol-01 */
export function rutaDe(dist, archivo) {
  let r = '/' + path.relative(dist, archivo).replace(/\\/g, '/');
  r = r.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return r === '' ? '/' : r;
}

export function decodificar(s) {
  return s
    .replace(/&amp;|&#38;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Número de línea (1-based) del índice `i` dentro de `s`. */
export function lineaDe(s, i) {
  let n = 1;
  for (let k = 0; k < i && k < s.length; k++) if (s.charCodeAt(k) === 10) n++;
  return n;
}

/** Texto visible: sin <script>, <style>, <svg>, <template>, sin etiquetas, entidades decodificadas. */
export function textoVisible(html) {
  const sin = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return decodificar(sin.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ');
}

/** ¿Es una página de redirección (meta refresh)? */
export function esRedireccion(html) {
  return /<meta\s+http-equiv="refresh"/i.test(html.slice(0, 3000));
}

/** Todas las etiquetas `<nombre …>` con sus atributos (sin hijos). */
export function etiquetas(html, nombre) {
  const re = new RegExp(`<${nombre}\\b([^>]*)>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push({ indice: m.index, linea: lineaDe(html, m.index), attrs: atributos(m[1]), crudo: m[0] });
  return out;
}

export function atributos(s) {
  const out = {};
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

/** Enlaces (href de <a>/<link>, src de <img>/<script>/<source>/<iframe>, srcset) con línea. */
export function referencias(html) {
  const out = [];
  for (const t of etiquetas(html, 'a')) if (t.attrs.href != null) out.push({ tipo: 'a', url: decodificar(t.attrs.href), linea: t.linea });
  for (const t of etiquetas(html, 'link')) if (t.attrs.href) out.push({ tipo: 'link', url: decodificar(t.attrs.href), linea: t.linea });
  for (const n of ['img', 'script', 'iframe', 'source']) {
    for (const t of etiquetas(html, n)) {
      if (t.attrs.src) out.push({ tipo: n, url: decodificar(t.attrs.src), linea: t.linea });
      if (t.attrs.srcset) for (const parte of t.attrs.srcset.split(',')) {
        const u = parte.trim().split(/\s+/)[0];
        if (u) out.push({ tipo: `${n}[srcset]`, url: decodificar(u), linea: t.linea });
      }
    }
  }
  return out;
}

/** Ids de la página (id="…" y name="…" de <a>). */
export function ids(html) {
  const s = new Set();
  let m;
  const re = /\sid="([^"]+)"/g;
  while ((m = re.exec(html))) s.add(decodificar(m[1]));
  const re2 = /<a\b[^>]*\sname="([^"]+)"/gi;
  while ((m = re2.exec(html))) s.add(decodificar(m[1]));
  return s;
}

export function leer(archivo) {
  return fs.readFileSync(archivo, 'utf8');
}
