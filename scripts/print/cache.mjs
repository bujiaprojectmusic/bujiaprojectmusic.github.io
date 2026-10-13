// Caché de los PDF por volumen (y del kit): sólo se compila lo que cambió.
//
// Huella de un volumen = sha256 de:
//   - el volumen.json recién exportado (ANTES de variantes.mjs, que le
//     reescribe las rutas de las fotos): ahí ya está todo el contenido
//     resuelto (piezas, textos, pies, créditos, paleta, datos del taller);
//   - cada archivo que ese JSON nombra (fotos master, QR, SVG de marca),
//     por su contenido;
//   - el motor: print/** (salvo build/ y cache/), scripts/print/** y
//     package-lock.json (versiones de sharp, qrcode, pdf-lib, Typst vía
//     print/TYPST_VERSION).
// Typst no lee nada más: sus únicas lecturas fijas son print/reglas.json y
// print/componentes.json (dentro del motor) y el resto le llega por el JSON.
//
// Si la huella existe en print/cache/<slug>/<huella>/, se restauran los
// PDF, las miniaturas y la entrada del manifest (con los chequeos que ya
// pasaron con esas mismas entradas) en vez de compilar. En CI la carpeta
// print/cache/ se guarda con actions/cache (ver .github/workflows/deploy.yml).
// --sin-cache en build.mjs / build-kit.mjs la ignora.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ } from './lib/reglas.mjs';

export const CACHE = path.join(RAIZ, 'print', 'cache');
const EXT_ARCHIVO = /\.(svg|png|jpe?g|webp|gif|avif|tiff?)$/i;

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function listar(dir, excluir = []) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (excluir.some((x) => p === x)) continue;
    if (e.isDirectory()) out.push(...listar(p, excluir));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

let motorMemo = null;
/** Huella del motor del impreso: si cambia, se recompila todo (y está bien). */
export function huellaMotor() {
  if (motorMemo) return motorMemo;
  const archivos = [
    ...listar(path.join(RAIZ, 'print'), [path.join(RAIZ, 'print', 'build'), path.join(RAIZ, 'print', 'cache')]),
    ...listar(path.join(RAIZ, 'scripts', 'print')),
    path.join(RAIZ, 'package-lock.json'),
  ].filter((p) => fs.existsSync(p)).sort();
  const h = crypto.createHash('sha256');
  for (const p of archivos) h.update(rel(p)).update('\0').update(fs.readFileSync(p)).update('\0');
  motorMemo = h.digest('hex');
  return motorMemo;
}

/** Rutas de archivo que nombra el JSON (strings con extensión de imagen que existen). */
function archivosNombrados(valor, out = new Set()) {
  if (typeof valor === 'string') {
    if (EXT_ARCHIVO.test(valor)) {
      const p = path.join(RAIZ, valor.replace(/^\//, ''));
      if (fs.existsSync(p) && fs.statSync(p).isFile()) out.add(p);
    }
  } else if (Array.isArray(valor)) for (const v of valor) archivosNombrados(v, out);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) archivosNombrados(v, out);
  return out;
}

/** Huella de un volumen (o del kit) a partir de su volumen.json recién exportado. */
export function huellaVolumen(jsonPath) {
  const texto = fs.readFileSync(jsonPath, 'utf8');
  const h = crypto.createHash('sha256').update(huellaMotor()).update('\0').update(texto).update('\0');
  for (const p of [...archivosNombrados(JSON.parse(texto))].sort()) h.update(rel(p)).update('\0').update(fs.readFileSync(p)).update('\0');
  return h.digest('hex').slice(0, 32);
}

/**
 * Restaura print/cache/<clave>/<huella>/ sobre `destino` (misma estructura
 * relativa). Devuelve el resultado guardado (entrada del manifest) o null.
 */
export function restaurar(clave, huella, destino) {
  const dir = path.join(CACHE, clave, huella);
  const meta = path.join(dir, 'resultado.json');
  if (!fs.existsSync(meta)) return null;
  for (const f of listar(dir)) {
    if (f === meta) continue;
    const a = path.join(destino, path.relative(dir, f));
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.copyFileSync(f, a);
  }
  return JSON.parse(fs.readFileSync(meta, 'utf8'));
}

/**
 * Guarda `archivos` (rutas dentro de `origen`) y el resultado en
 * print/cache/<clave>/<huella>/, y borra las huellas viejas de esa clave
 * (la caché guarda sólo la versión vigente de cada volumen).
 */
export function guardar(clave, huella, origen, archivos, resultado) {
  const base = path.join(CACHE, clave);
  fs.rmSync(base, { recursive: true, force: true });
  const dir = path.join(base, huella);
  for (const f of archivos) {
    const a = path.join(dir, path.relative(origen, f));
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.copyFileSync(f, a);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(resultado, null, 2));
}

/** Borra de la caché los volúmenes que ya no existen (deja `kit` y lo que se pida conservar). */
export function podar(vigentes) {
  if (!fs.existsSync(CACHE)) return;
  for (const e of fs.readdirSync(CACHE, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== 'kit' && !vigentes.includes(e.name)) fs.rmSync(path.join(CACHE, e.name), { recursive: true, force: true });
  }
}
