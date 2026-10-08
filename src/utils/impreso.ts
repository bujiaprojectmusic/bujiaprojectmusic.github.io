// Lee print/build/manifest.json (lo escribe scripts/print/build.mjs, issue
// #9) en tiempo de build para pintar el bloque de descarga de PDFs de un
// volumen. Si no existe (build local sin Typst), devuelve null y el bloque
// dice "PDF no disponible en este build". Los PDF los copia
// scripts/print/copy-dist.mjs a dist/fanzine/<slug>/ después de astro build.
import fs from 'node:fs';
import path from 'node:path';

export interface PdfImpreso {
  archivo: string;
  bytes: number;
  paginas: number;
}
export interface VolumenImpreso {
  slug: string;
  paginas: number;
  pdfs: {
    pantalla: PdfImpreso;
    imprenta: PdfImpreso;
    cuadernillo: PdfImpreso & { hojas?: number };
    xerox: PdfImpreso;
    cuadernilloXerox: PdfImpreso & { hojas?: number };
    comoImprimir: PdfImpreso;
  };
}

let cache: { volumenes: VolumenImpreso[] } | null | undefined;

export function manifestImpreso(): { volumenes: VolumenImpreso[] } | null {
  if (cache !== undefined) return cache;
  const ruta = path.resolve(process.cwd(), 'print', 'build', 'manifest.json');
  cache = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : null;
  return cache;
}

export function impresoDe(slug: string): VolumenImpreso | null {
  return manifestImpreso()?.volumenes.find((v) => v.slug === slug) ?? null;
}

export function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
