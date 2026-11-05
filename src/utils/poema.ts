// Poema (template: "poema"): el cuerpo vive en un bloque ```poema para que
// los espacios y los saltos de línea no pasen por el reflujo de Markdown.
// Lo usan el remark de la web, el chequeo del build, el componente
// <VersoDestacado> y el QR del impreso.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** Quita un salto final y unifica CRLF. No recorta espacios de cada verso. */
export function normalizarCuerpo(v: string): string {
  return v.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/** Texto de los bloques ```poema, unidos si hay más de uno. */
export function cuerpoDePoema(md: string): string {
  const bloques = [...md.matchAll(/```poema[^\n]*\r?\n([\s\S]*?)```/g)].map((m) => normalizarCuerpo(m[1]));
  return bloques.join('\n\n');
}

/** Estrofas (separadas por una o más líneas en blanco) y, adentro, versos. */
export function estrofasDe(texto: string): string[][] {
  const limpio = normalizarCuerpo(texto);
  if (!limpio) return [];
  return limpio.split(/\n{2,}/).map((est) => est.split('\n'));
}

const escapar = (s: string) => s.replace(/[&<>]/g, (c) => ESC[c]);

/** HTML del cuerpo: un verso por línea, sin justificar; el blanco entre estrofas es margen. */
export function htmlPoema(texto: string): string {
  const estrofas = estrofasDe(texto);
  const inner = estrofas
    .map((lineas) => {
      const versos = lineas.map((linea) => `<span class="fz-poema-verso">${escapar(linea.length ? linea : '\u00a0')}</span>`).join('');
      return `<p class="fz-poema-estrofa">${versos}</p>`;
    })
    .join('');
  return `<div class="fz-poema-cuerpo">${inner}</div>`;
}

/** Nodo MDX (div/p/span) equivalente a htmlPoema, para el remark de la web. */
export function mdastPoema(texto: string) {
  const attr = (name: string, value: string) => ({ type: 'mdxJsxAttribute', name, value });
  const el = (name: string, clase: string, children: unknown[], flow: boolean) => ({
    type: flow ? 'mdxJsxFlowElement' : 'mdxJsxTextElement',
    name,
    attributes: [attr('class', clase)],
    children,
  });
  const estrofas = estrofasDe(texto).map((lineas) =>
    el(
      'p',
      'fz-poema-estrofa',
      lineas.map((linea) => el('span', 'fz-poema-verso', [{ type: 'text', value: linea.length ? linea : '\u00a0' }], false)),
      true,
    ),
  );
  return el('div', 'fz-poema-cuerpo', estrofas, true);
}

export function remarkPoema() {
  return (tree: { children?: unknown[] }) => {
    const walk = (node: { children?: any[] }) => {
      if (!node?.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child?.type === 'code' && child.lang === 'poema') node.children[i] = mdastPoema(child.value);
        else walk(child);
      }
    };
    walk(tree);
  };
}

export interface BloqueLiteral {
  tipo: 'verso' | 'video' | 'cuerpo';
  at: number;
  verso?: string;
  url?: string;
  credito?: string;
  leyenda?: string;
  texto?: string;
}

const atributo = (attrs: string, nombre: string) => attrs.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1] ?? '';

/** Orden de aparición para la vista previa. Atributos literales entre comillas. */
export function bloquesLiterales(md: string): BloqueLiteral[] {
  const out: BloqueLiteral[] = [];
  for (const m of md.matchAll(/<VersoDestacado\b([^>]*?)\/>/g)) {
    out.push({ tipo: 'verso', at: m.index ?? 0, verso: atributo(m[1], 'verso') });
  }
  for (const m of md.matchAll(/<VideoInstagram\b([^>]*?)\/>/g)) {
    out.push({
      tipo: 'video',
      at: m.index ?? 0,
      url: atributo(m[1], 'url'),
      credito: atributo(m[1], 'credito'),
      leyenda: atributo(m[1], 'leyenda'),
    });
  }
  for (const m of md.matchAll(/```poema[^\n]*\r?\n([\s\S]*?)```/g)) {
    out.push({ tipo: 'cuerpo', at: m.index ?? 0, texto: normalizarCuerpo(m[1]) });
  }
  return out.sort((a, b) => a.at - b.at);
}

export class ErrorPoema extends Error {}

/** URL pública del reel/post (sin query) y embed oficial, sin autoplay. */
export function partesInstagram(url: string): { tipo: 'reel' | 'p' | 'tv'; codigo: string } {
  const limpia = String(url ?? '');
  if (!limpia.trim()) throw new ErrorPoema('VideoInstagram: url vacía.');
  let u: URL;
  try {
    u = new URL(limpia.trim());
  } catch {
    throw new ErrorPoema(`VideoInstagram: url no es una URL (${limpia.trim()}).`);
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'instagram.com') throw new ErrorPoema(`VideoInstagram: la url tiene que ser de instagram.com (${limpia.trim()}).`);
  const m = u.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) throw new ErrorPoema(`VideoInstagram: la url tiene que ser un reel, un post o un IGTV (${limpia.trim()}).`);
  const tipo = (m[1] === 'reels' ? 'reel' : m[1]) as 'reel' | 'p' | 'tv';
  return { tipo, codigo: m[2] };
}

export function urlPublicaInstagram(url: string): string {
  const { tipo, codigo } = partesInstagram(url);
  return `https://www.instagram.com/${tipo}/${codigo}/`;
}

/** Iframe oficial. Sin parámetros de autoplay: el navegador no lo habilita. */
export function embedInstagram(url: string): string {
  const { tipo, codigo } = partesInstagram(url);
  return `https://www.instagram.com/${tipo}/${codigo}/embed`;
}

/**
 * Lado del SVG (zona de silencio incluida) para que los módulos del símbolo
 * midan al menos `minimoCm`. El SVG de `qrcode` trae `margin` módulos de
 * silencio por lado; el viewBox es símbolo + 2×margin.
 */
export function ladoQrCm(svg: string, minimoCm = 2.5, margenModulos = 4): number {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) throw new ErrorPoema('VideoInstagram: el SVG del QR no trae viewBox.');
  const total = parseFloat(m[1]);
  const simbolo = total - margenModulos * 2;
  if (!(simbolo > 0)) throw new ErrorPoema('VideoInstagram: el QR no tiene módulos.');
  return Math.ceil((minimoCm * total / simbolo) * 100) / 100;
}
