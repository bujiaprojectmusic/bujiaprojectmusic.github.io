// ─────────────────────────────────────────────────────────────────────────
// Composición de un volumen a partir de su yml (issue #13): asigna la
// página final de cada pieza, detecta traslapes y piezas draft (error),
// rellena los huecos con páginas diseñadas (aviso) y calcula N (múltiplo
// de 4): piezas en 3…N-2, Fin = N-1, contraportada = N. Función pura sin
// dependencias de Astro: la usan src/pages/fanzine/[slug].astro (web) y
// scripts/print/sources/piezas.ts (impreso, vía tsx).
// ─────────────────────────────────────────────────────────────────────────
import { PRIMERA_PAGINA_PIEZA, RELLENOS, type Relleno } from '../content/schemas';

export interface PiezaResumen {
  id: string;
  titulo: string;
  autor: string;
  paginas: number;
  draft: boolean;
}
export type EntradaVolumen = { pieza: PiezaResumen; desde: number } | { relleno: Relleno; desde: number };

export type PaginaCompuesta =
  | { n: 1; tipo: 'portada' }
  | { n: 2; tipo: 'indice' }
  | { n: number; tipo: 'pieza'; pieza: PiezaResumen; desde: number; rel: number }
  | { n: number; tipo: 'relleno'; relleno: Relleno; declarado: boolean }
  | { n: number; tipo: 'fin' }
  | { n: number; tipo: 'contraportada' };

export interface Composicion {
  /** Total de páginas, múltiplo de 4. */
  N: number;
  paginas: PaginaCompuesta[];
  /** Entradas del índice: una por pieza, con su página final. */
  indice: { pagina: number; titulo: string; autor: string; id: string }[];
  avisos: string[];
}

export class ErrorComposicion extends Error {}

const MULTIPLO = 4;
const MINIMO = 8; // portada, índice, al menos una pieza en 3…, Fin, contraportada… y múltiplo de 4 → 8

/** Compone el volumen `nombre` (p. ej. "vol-01") con sus entradas ordenadas. */
export function componer(nombre: string, entradas: EntradaVolumen[], usoGlobal?: Map<string, string>, minimo = MINIMO): Composicion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const ocupadas = new Map<number, string>();
  const ordenadas = [...entradas].sort((a, b) => a.desde - b.desde);
  let ultima = PRIMERA_PAGINA_PIEZA - 1;
  const paginasPieza = new Map<number, PaginaCompuesta>();
  const indice: Composicion['indice'] = [];
  for (const e of ordenadas) {
    if ('pieza' in e) {
      const p = e.pieza;
      if (p.draft) errores.push(`la pieza "${p.titulo}" (${p.id}) es draft y no puede entrar en ${nombre}.`);
      if (usoGlobal) {
        const otro = usoGlobal.get(p.id);
        if (otro && otro !== nombre) errores.push(`la pieza "${p.titulo}" (${p.id}) ya está en ${otro}: una pieza va en un solo volumen.`);
        usoGlobal.set(p.id, nombre);
      }
      for (let i = 0; i < p.paginas; i++) {
        const n = e.desde + i;
        const dueno = ocupadas.get(n);
        if (dueno) errores.push(`traslape en la pág. ${n}: "${p.titulo}" (${p.id}, desde ${e.desde}, ${p.paginas} págs) pisa a ${dueno}.`);
        ocupadas.set(n, `"${p.titulo}" (${p.id})`);
        paginasPieza.set(n, { n, tipo: 'pieza', pieza: p, desde: e.desde, rel: i + 1 });
      }
      indice.push({ pagina: e.desde, titulo: p.titulo, autor: p.autor, id: p.id });
      ultima = Math.max(ultima, e.desde + p.paginas - 1);
    } else {
      const dueno = ocupadas.get(e.desde);
      if (dueno) errores.push(`traslape en la pág. ${e.desde}: el relleno "${e.relleno}" pisa a ${dueno}.`);
      ocupadas.set(e.desde, `relleno "${e.relleno}"`);
      paginasPieza.set(e.desde, { n: e.desde, tipo: 'relleno', relleno: e.relleno, declarado: true });
      ultima = Math.max(ultima, e.desde);
    }
  }
  // N: la última página ocupada + Fin + contraportada, redondeado a múltiplo de 4.
  const N = Math.max(MINIMO, minimo, Math.ceil((ultima + 2) / MULTIPLO) * MULTIPLO);
  if (errores.length) throw new ErrorComposicion(`${nombre}: el volumen no cierra:\n  - ${errores.join('\n  - ')}`);
  const paginas: PaginaCompuesta[] = [{ n: 1, tipo: 'portada' }, { n: 2, tipo: 'indice' }];
  let relleno = 0;
  for (let n = PRIMERA_PAGINA_PIEZA; n <= N - 2; n++) {
    const p = paginasPieza.get(n);
    if (p) { paginas.push(p); continue; }
    const tipo = RELLENOS[relleno++ % RELLENOS.length];
    avisos.push(`pág. ${n}: hueco en ${nombre}; va una página de relleno diseñada (${tipo}). Para elegirla, agregá { relleno: '${tipo}', desde: ${n} } al yml.`);
    paginas.push({ n, tipo: 'relleno', relleno: tipo, declarado: false });
  }
  paginas.push({ n: N - 1, tipo: 'fin' }, { n: N, tipo: 'contraportada' });
  if (N > 28) avisos.push(`${nombre}: ${N} páginas, más de 28 (costo de tinta, peso, grapas). No bloquea.`);
  return { N, paginas, indice: indice.sort((a, b) => a.pagina - b.pagina), avisos };
}

/** Slug "vol-NN" (dos dígitos) del número de volumen. */
export function slugVolumen(numero: number): string {
  return `vol-${String(numero).padStart(2, '0')}`;
}
