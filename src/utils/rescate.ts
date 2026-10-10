// Letras de un título "carta de rescate" (TituloRescate, issue #17 parte b).
// Cada letra sale con un estilo (0–3: papel con borde, tinta, acento,
// papel con borde punteado), una fuente (anton | mono), un giro y una
// escala, generados con un generador determinista (Park–Miller, 31 bits:
// los mismos enteros en JS y en Typst, sin desbordes) a partir de una
// semilla: por default, un hash del texto. La web (TituloRescate.astro) y
// el impreso (export.ts → props.letras → punk.typ#titulo-rescate) usan ESTA
// función, así el mismo título se ve igual en los dos lados.
import geo from '../../print/componentes.json';

export interface LetraRescate {
  c: string;
  /** true = espacio entre palabras (no se dibuja recorte). */
  espacio?: boolean;
  estilo: number;
  fuente: 'anton' | 'mono';
  /** Giro en grados (±giro_grados_max). */
  giro: number;
  /** Escala del tamaño de letra (escala_min … escala_max). */
  escala: number;
}

const G = geo.titulo_rescate;
const M = 2147483647;

/** Hash determinista del texto (31 bits). */
export function semillaDe(texto: string): number {
  let h = 7;
  for (const ch of texto) h = (h * 31 + ch.codePointAt(0)!) % M;
  return h || 1;
}

export function letrasRescate(texto: string, semilla?: number): LetraRescate[] {
  let s = ((semilla ?? semillaDe(texto)) % (M - 1)) + 1;
  const sig = () => { s = (s * 48271) % M; return s; };
  const out: LetraRescate[] = [];
  let anterior = -1;
  for (const c of texto) {
    if (c === ' ') { out.push({ c, espacio: true, estilo: 0, fuente: 'mono', giro: 0, escala: 1 }); continue; }
    let estilo = sig() % G.estilos;
    if (estilo === anterior) estilo = (estilo + 1) % G.estilos; // dos recortes iguales seguidos se ven mal
    anterior = estilo;
    const fuente = sig() % 3 === 0 ? 'mono' : 'anton';
    const giro = (sig() % (2 * G.giro_grados_max + 1)) - G.giro_grados_max;
    const escala = Math.round((G.escala_min + ((sig() % 101) / 100) * (G.escala_max - G.escala_min)) * 100) / 100;
    out.push({ c, estilo, fuente, giro, escala });
  }
  return out;
}
