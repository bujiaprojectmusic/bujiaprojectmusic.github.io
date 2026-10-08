// Tipos del JSON del impreso (print/build/<slug>/volumen.json, "version": 1).
// Lo escribe scripts/print/export.ts y lo leen print/volumen.typ (json()) y
// scripts/print/check.mjs. Cuando entre #13 (colecciones piezas/volumenes)
// sólo se agrega otro adaptador en scripts/print/sources/; este formato y
// Typst no cambian.

export type Nodo =
  | { t: 'texto'; v: string }
  | { t: 'parrafo'; hijos: Nodo[] }
  | { t: 'fuerte'; hijos: Nodo[] }
  | { t: 'enfasis'; hijos: Nodo[] }
  | { t: 'codigo'; v: string }
  | { t: 'salto' }
  | { t: 'liga'; destino: { tipo: 'ref'; pagina: number } | { tipo: 'externa' }; hijos: Nodo[] }
  | { t: 'titulo'; nivel: number; hijos: Nodo[] }
  | { t: 'lista'; ordenada: boolean; inicio: number; items: Nodo[][] }
  | { t: 'cita'; hijos: Nodo[] }
  | { t: 'separador' }
  | { t: 'bloque_codigo'; v: string }
  | { t: 'imagen'; foto: string; alt: string; pie?: string }
  | { t: 'html'; etiqueta: string; clase: string; hijos: Nodo[] }
  | { t: 'componente'; nombre: string; props: Record<string, unknown>; hijos: Nodo[] };

export interface Foto {
  id: string;
  /** Ruta del master relativa a la raíz del repo (nunca se edita). */
  master: string;
  /** Ancho/alto en px ya orientados (EXIF aplicado). */
  ancho_px: number;
  alto_px: number;
  formato: string;
  /** false si el archivo no existe (se dibuja un recuadro "imagen pendiente"). */
  existe: boolean;
  usos: { pliego: number; componente: string; ancho_pt: number }[];
  /** Rellenados por variantes.mjs (rutas relativas a la raíz del repo). */
  imprenta?: string;
  pantalla?: string;
  bn?: string;
  bn_imprenta?: string;
}

export interface Pliego {
  n: number;
  tipo: 'portada' | 'indice' | 'normal' | 'relleno' | 'fin' | 'contraportada';
  esquema: string | null;
  /** Relleno generado porque faltaba el <Pliego n> (o venía vacío). */
  relleno?: 'colabora' | 'notas' | 'taller';
  /** Foto a sangre (id) con el texto encima, o fondo de color del esquema. */
  bleed?: string;
  bleed_color?: boolean;
  nodos: Nodo[];
  origen?: { archivo: string; linea: number };
}

export interface Volumen {
  version: 1;
  slug: string;
  volumen: number;
  titulo: string;
  subtitulo?: string;
  fecha: string;
  autor: string;
  descripcion?: string;
  esquema: string;
  prueba: boolean;
  multimedia: 'qr' | 'omitir';
  url: string;
  sitio: string;
  paginas: number;
  fijas: { portada: number; indice: number; fin: number; contraportada: number; pliegoCentral: number[] };
  indice: { pagina: number; titulo: string }[];
  paleta: Record<string, { ink: string; accent: string; paper: string }>;
  pliegos: Pliego[];
  fotos: Foto[];
  qrs: { id: string; url: string; archivo: string }[];
  avisos: string[];
  origen: string;
}
