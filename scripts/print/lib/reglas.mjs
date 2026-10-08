// Carga print/reglas.json (único lugar con las medidas del impreso) y
// expone las reglas de páginas (múltiplo de 4, aviso > 28) y el orden de
// hojas del cuadernillo para N páginas. Lo usan scripts/print/*.mjs; #9 y
// #10 lo reutilizan.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const RUTA_REGLAS = path.join(RAIZ, 'print', 'reglas.json');
export const reglas = JSON.parse(fs.readFileSync(RUTA_REGLAS, 'utf8'));

/**
 * Revisa el total de páginas de un volumen según reglas.paginas.
 * Devuelve { ok, errores[], avisos[] }: múltiplo de 4 y mínimo son errores;
 * pasarse de `aviso_mas_de` es sólo un aviso (no bloquea el build).
 */
export function revisarPaginas(n) {
  const p = reglas.paginas;
  const errores = [];
  const avisos = [];
  if (!Number.isInteger(n) || n < p.minimo) errores.push(`${n} páginas: el mínimo es ${p.minimo}`);
  if (Number.isInteger(n) && n % p.multiplo !== 0) {
    const siguiente = Math.ceil(n / p.multiplo) * p.multiplo;
    errores.push(`${n} páginas no es múltiplo de ${p.multiplo}: faltan ${siguiente - n} páginas de relleno diseñadas (→ ${siguiente})`);
  }
  if (Number.isInteger(n) && n > p.aviso_mas_de) avisos.push(`${n} páginas: más de ${p.aviso_mas_de} (costo de tinta, peso, grapas). No bloquea.`);
  if (Number.isInteger(n) && (n < p.recomendado_min || n > p.recomendado_max) && n <= p.aviso_mas_de) avisos.push(`${n} páginas: fuera del rango recomendado ${p.recomendado_min}–${p.recomendado_max}.`);
  return { ok: errores.length === 0, errores, avisos };
}

/** Páginas fijas para un volumen de N páginas. */
export function paginasFijas(n) {
  return { portada: 1, indice: 2, piezas: [3, n - 2], fin: n - 1, contraportada: n, pliegoCentral: [n / 2, n / 2 + 1] };
}

/**
 * Orden de impresión del cuadernillo (carta horizontal, 2 páginas por cara,
 * doble cara volteando por el borde corto) para N páginas (múltiplo de 4).
 * Hoja h (desde 1): frente = [N - 2(h-1), 2h - 1], vuelta = [2h, N - 2h + 1].
 */
export function cuadernillo(n) {
  const r = revisarPaginas(n);
  if (!r.ok) throw new Error(r.errores.join('; '));
  const hojas = [];
  for (let h = 1; h <= n / 4; h++) {
    hojas.push({ hoja: h, frente: [n - 2 * (h - 1), 2 * h - 1], vuelta: [2 * h, n - 2 * h + 1] });
  }
  return hojas;
}

/** Hoja y cara donde cae la página p en un cuadernillo de N. */
export function hojaDePagina(p, n) {
  for (const h of cuadernillo(n)) {
    if (h.frente.includes(p)) return { hoja: h.hoja, cara: 'frente', par: h.frente };
    if (h.vuelta.includes(p)) return { hoja: h.hoja, cara: 'vuelta', par: h.vuelta };
  }
  throw new Error(`página ${p} fuera de 1…${n}`);
}
