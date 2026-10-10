// ─────────────────────────────────────────────────────────────────────────
// Acceso tipado al registro único de componentes (issue #17):
// src/components/fanzine/registro.json. De acá salen /fanzine/kit (web),
// el MDX copiable de cada componente y, vía scripts/print/kit.ts, el
// volumen sintético que Typst compila a jirafa-kit.pdf. El chequeo de
// catálogo del export (scripts/print/lib/mdx.ts) lee el mismo JSON.
// ─────────────────────────────────────────────────────────────────────────
import registro from './registro.json';

export type Estado = 'aprobado' | 'propuesto';
export type Grupo = 'pagina' | 'titulos' | 'bloques' | 'imagenes' | 'multimedia' | 'marca' | 'taller' | 'infra' | 'propuestos';

export interface PropRegistro {
  nombre: string;
  tipo: string;
  default: string | null;
  obligatoria: boolean;
  que: string;
}

export interface DemoRegistro {
  props: Record<string, unknown>;
  /** Hijos del ejemplo: texto plano / Markdown simple (párrafos separados por línea en blanco) o HTML. */
  hijos: string | null;
  /** Párrafo que va DESPUÉS del componente en el MDX (p. ej. el que rodea a <ImageSide>). */
  despues?: string;
}

export interface Componente {
  nombre: string;
  grupo: Grupo;
  tipo: 'componente' | 'estilo';
  descripcion: string;
  web: string | null;
  typst: string | null;
  props: PropRegistro[];
  estado: Estado;
  volumen: number | null;
  soloWeb: false | string;
  soloImpreso: false | string;
  mdx: boolean;
  demo: DemoRegistro | null;
  notas: string;
}

export interface PiezaDemo {
  id: string;
  paginas: number;
  credito: string;
  scheme: string;
  fotos: { src: string; alt: string; pie: string; credito: string }[];
}

export const REGISTRO = registro as unknown as {
  version: number;
  limites: { css_gzip_kb: number; svg_gzip_kb: number; script_fachada_gzip_kb: number };
  esquemas_kit: string[];
  pieza_demo: PiezaDemo;
  componentes: Componente[];
};

export const componentes = (): Componente[] => REGISTRO.componentes;
export const aprobados = (): Componente[] => REGISTRO.componentes.filter((c) => c.estado === 'aprobado');
export const propuestos = (): Componente[] => REGISTRO.componentes.filter((c) => c.estado === 'propuesto');
export const buscar = (nombre: string): Componente | undefined => REGISTRO.componentes.find((c) => c.nombre === nombre);

export const GRUPOS: Record<Grupo, string> = {
  pagina: 'Páginas y estructura',
  titulos: 'Títulos',
  bloques: 'Bloques de texto',
  imagenes: 'Imágenes',
  multimedia: 'Video y playlists (fachadas)',
  marca: 'Marca: stickers, cintas, texturas',
  taller: 'Piezas del taller',
  infra: 'Infraestructura',
  propuestos: 'Propuestos (pendientes de la puerta 2)',
};

/** Valor de una prop como atributo MDX: cadena entre comillas, el resto entre llaves. */
export function atributoMdx(nombre: string, v: unknown): string {
  if (v === true) return nombre;
  if (typeof v === 'string') return `${nombre}="${v.replace(/"/g, '&quot;')}"`;
  return `${nombre}={${JSON.stringify(v)}}`;
}

/** Ruta de import del .astro desde src/content/piezas/<carpeta>/index.mdx. */
export function importMdx(c: Componente): string | null {
  if (!c.web || !c.web.endsWith('.astro')) return null;
  return `import ${c.nombre} from '../../../${c.web.replace(/^src\//, '')}';`;
}

/** El MDX copiable del ejemplo (sin el import). Mismo texto que compila Typst para el kit. */
export function ejemploMdx(c: Componente): string {
  const d = c.demo;
  if (!d) return c.estado === 'propuesto' ? `{/* <${c.nombre} …/>: propuesto, todavía no existe */}` : `{/* ${c.nombre}: sin ejemplo en MDX (${c.soloWeb || 'infraestructura'}) */}`;
  const partes: string[] = [];
  if (c.tipo === 'estilo') {
    partes.push(d.hijos ?? '');
  } else {
    const attrs = Object.entries(d.props).map(([k, v]) => atributoMdx(k, v)).join(' ');
    const abre = `<${c.nombre}${attrs ? ' ' + attrs : ''}`;
    if (d.hijos == null) partes.push(`${abre} />`);
    else partes.push(`${abre}>\n${d.hijos.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}\n</${c.nombre}>`);
  }
  if (d.despues) partes.push('', d.despues);
  return partes.join('\n');
}

/** Hijos del demo como HTML para la web: párrafos (línea en blanco) → <p>; HTML y encabezados Markdown pasan tal cual. */
export function hijosHtml(hijos: string | null | undefined): string {
  if (!hijos) return '';
  return hijos
    .split(/\n\s*\n/)
    .map((p) => {
      const t = p.trim();
      if (!t) return '';
      if (/^</.test(t)) return t;
      const h = t.match(/^(#{2,4})\s+(.*)$/);
      if (h) return `<h${h[1].length}>${escapar(h[2])}</h${h[1].length}>`;
      return `<p>${inline(escapar(t))}</p>`;
    })
    .join('\n');
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** **negrita**, *cursiva*, `código` (lo mismo que entiende el export). */
const inline = (s: string) =>
  s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
