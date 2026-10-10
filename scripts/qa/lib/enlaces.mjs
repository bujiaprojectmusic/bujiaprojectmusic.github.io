// Enlaces y anclas sobre dist/ (issue #14, alcance 1).
//  - Internos: todo href/src resuelve a un archivo de dist/ y toda #ancla
//    existe en la página destino. Fallan.
//  - Externos: HEAD/GET con reintentos; si siguen fallando, aviso (no
//    tumban el CI). Excepciones en .github/qa/enlaces-ignorar.txt.
import fs from 'node:fs';
import path from 'node:path';
import { listarHtml, rutaDe, referencias, ids, leer, esRedireccion } from './html.mjs';
import { resolverArchivo } from './servidor.mjs';

export function leerIgnorados(archivo = '.github/qa/enlaces-ignorar.txt') {
  if (!fs.existsSync(archivo)) return [];
  return fs
    .readFileSync(archivo, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function ignorado(url, patrones) {
  return patrones.some((p) => (p.endsWith('*') ? url.startsWith(p.slice(0, -1)) : url === p || url.startsWith(p + '/') || url.startsWith(p + '?')));
}

const ESQUEMAS_SALTAR = /^(mailto:|tel:|javascript:|data:|sms:|whatsapp:)/i;

/**
 * @param {object} o { dist, sitio: 'https://bujiaprojectmusic.com', externos: true, ignorar: [], reintentos: 2, timeoutMs: 10000 }
 */
export async function revisarEnlaces(o) {
  const dist = path.resolve(o.dist);
  const sitio = (o.sitio ?? '').replace(/\/$/, '');
  const ignorar = o.ignorar ?? leerIgnorados();
  const errores = [];
  const avisos = [];
  const externos = new Map(); // url → [{archivo, linea}]
  let internos = 0;
  let anclas = 0;
  const cacheIds = new Map();
  const idsDe = (archivo) => {
    if (!cacheIds.has(archivo)) cacheIds.set(archivo, ids(leer(archivo)));
    return cacheIds.get(archivo);
  };

  for (const archivo of listarHtml(dist)) {
    const html = leer(archivo);
    if (esRedireccion(html)) continue;
    const ruta = rutaDe(dist, archivo);
    const rel = path.relative(process.cwd(), archivo);
    for (const r of referencias(html)) {
      let url = r.url.trim();
      if (!url || ESQUEMAS_SALTAR.test(url)) continue;
      if (/^https?:\/\//i.test(url) || url.startsWith('//')) {
        if (sitio && url.startsWith(sitio + '/')) url = url.slice(sitio.length);
        else if (sitio && url === sitio) url = '/';
        else {
          if (url.startsWith('//')) url = 'https:' + url;
          if (ignorado(url, ignorar)) continue;
          if (!externos.has(url)) externos.set(url, []);
          externos.get(url).push({ archivo: rel, linea: r.linea });
          continue;
        }
      }
      // Interno: ruta absoluta, relativa o sólo ancla.
      let [sinAncla, ancla] = url.split('#');
      let destino;
      if (sinAncla === '') destino = archivo;
      else {
        const abs = sinAncla.startsWith('/') ? sinAncla : path.posix.normalize(path.posix.join(path.posix.dirname(ruta === '/' ? '/index' : ruta), sinAncla));
        destino = resolverArchivo(dist, abs);
        internos++;
        if (!destino) {
          errores.push({ archivo: rel, linea: r.linea, mensaje: `enlace interno roto: ${r.tipo} → "${sinAncla}" no existe en dist/` });
          continue;
        }
      }
      if (ancla != null && ancla !== '' && destino.endsWith('.html')) {
        anclas++;
        if (!idsDe(destino).has(decodeURIComponent(ancla))) {
          errores.push({ archivo: rel, linea: r.linea, mensaje: `ancla inexistente: "#${ancla}" no está en ${path.relative(process.cwd(), destino)}` });
        }
      }
    }
  }

  let externosOk = 0;
  let externosMal = 0;
  if (o.externos !== false && externos.size) {
    const cola = [...externos.entries()];
    const trabajadores = Array.from({ length: 6 }, async () => {
      while (cola.length) {
        const [url, donde] = cola.shift();
        const r = await probarExterno(url, o.reintentos ?? 2, o.timeoutMs ?? 10000);
        if (r.ok) externosOk++;
        else {
          externosMal++;
          avisos.push({ archivo: donde[0].archivo, linea: donde[0].linea, mensaje: `enlace externo sin respuesta (${r.motivo}): ${url}${donde.length > 1 ? ` (+${donde.length - 1} más)` : ''}` });
        }
      }
    });
    await Promise.all(trabajadores);
  }
  return {
    nombre: 'Enlaces y anclas',
    estado: errores.length ? 'error' : avisos.length ? 'aviso' : 'ok',
    resumen: `${internos} enlaces internos, ${anclas} anclas, ${externos.size} externos distintos${o.externos === false ? ' (no probados)' : ` (${externosOk} ok, ${externosMal} sin respuesta)`}`,
    errores,
    avisos,
  };
}

async function probarExterno(url, reintentos, timeoutMs) {
  let motivo = '';
  for (let i = 0; i <= reintentos; i++) {
    for (const metodo of ['HEAD', 'GET']) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), timeoutMs);
        const res = await fetch(url, { method: metodo, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; jirafa-qa/1.0)' } });
        clearTimeout(t);
        if (res.status < 400 || res.status === 405 || res.status === 403 || res.status === 429) return { ok: true };
        motivo = `HTTP ${res.status}`;
        if (metodo === 'GET') break;
      } catch (e) {
        motivo = e.name === 'AbortError' ? 'timeout' : (e.cause?.code ?? e.message);
        if (metodo === 'GET') break;
      }
    }
    if (i < reintentos) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return { ok: false, motivo };
}
