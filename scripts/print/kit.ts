// Volumen sintético del KIT de componentes (issue #17): arma, desde
// src/components/fanzine/registro.json, un volumen con una página por
// componente aprobado (portada = Portada, pág. 2 = Indice, última =
// Contraportada, páginas que faltan = relleno diseñado) y lo exporta con el
// MISMO export.ts de los volúmenes (print/build/kit/volumen.json + qr/).
// Cada página compila el MDX de ejemplo del registro (el mismo texto que
// se copia en /fanzine/kit), así que la paridad web ↔ Typst es por
// construcción. Lo llama scripts/print/build-kit.mjs.
//   npx tsx scripts/print/kit.ts [--salida print/build/kit]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRO, GRUPOS, ejemploMdx, importMdx, type Componente } from '../../src/components/fanzine/registro.ts';
import { parsearMdx, leerImports, convertirHijos, ErrorExport, type Contexto, type PliegoCrudo } from './lib/mdx.ts';
import { exportar, RAIZ, type FuenteCompuesta } from './export.ts';
import type { Nodo } from './lib/tipos.ts';
import { toAssetPath } from '../../src/utils/rutasAssets.ts';

const ARCHIVO = 'src/components/fanzine/registro.json';

/** MDX → nodos del impreso (con el chequeo de catálogo de mdx.ts). */
function nodosDe(mdx: string, quien: string, avisos: string[]): Nodo[] {
  const tree = parsearMdx(mdx);
  const { componentes } = leerImports(tree);
  const ctx: Contexto = { archivo: `${ARCHIVO}#${quien}`, lineaBase: 0, componentes, datos: new Map(), paginaDeLiga: () => null, avisos };
  return convertirHijos(ctx, tree.children.filter((n: any) => n.type !== 'mdxjsEsm'));
}

/** Imports que necesita el MDX de ejemplo (el propio componente + los que use adentro). */
function imports(c: Componente): string {
  const out = new Set<string>();
  const propio = importMdx(c);
  if (propio) out.add(propio);
  const texto = ejemploMdx(c);
  for (const otro of REGISTRO.componentes) {
    const imp = importMdx(otro);
    if (imp && otro.nombre !== c.nombre && new RegExp(`<${otro.nombre}[\\s/>]`).test(texto)) out.add(imp);
  }
  return [...out].join('\n');
}

export function paginasKit(): { pliegos: (PliegoCrudo & { relleno?: string; kit?: any })[]; N: number; avisos: string[]; componentes: any[] } {
  const avisos: string[] = [];
  const esquemas = REGISTRO.esquemas_kit;
  const P = REGISTRO.pieza_demo;
  const fijos = new Set(['Portada', 'Indice', 'Contraportada']);
  const demoables = REGISTRO.componentes.filter((c) => c.estado === 'aprobado' && c.demo && c.typst && !c.soloWeb);
  const sueltos = demoables.filter((c) => !fijos.has(c.nombre));
  const total = 2 + sueltos.length + 2; // portada, índice, …, fin, contraportada
  const N = Math.ceil(total / 4) * 4;
  const pliegos: (PliegoCrudo & { relleno?: string; kit?: any })[] = [];
  const componentes: any[] = [];
  const porNombre = (n: string) => REGISTRO.componentes.find((c) => c.nombre === n);
  const crudo = (n: number, tipo: string, c: Componente | undefined, hijos: Nodo[], extra: Record<string, unknown> = {}): PliegoCrudo & { relleno?: string; kit?: any } => {
    const esquema = tipo === 'normal' ? esquemas[(n - 3) % esquemas.length] : null;
    const p = { n, tipo, esquema, props: { n, tipo, ...(esquema ? { scheme: esquema } : {}), ...extra }, hijos, linea: c ? REGISTRO.componentes.indexOf(c) + 1 : 0 } as PliegoCrudo & { relleno?: string; kit?: any };
    if (c) componentes.push({ nombre: c.nombre, pagina: n, esquema: esquema ?? 'volumen', typst: c.typst, grupo: c.grupo, web: c.web, estado: c.estado });
    return p;
  };
  const nodosEjemplo = (c: Componente) => nodosDe(`${imports(c)}\n\n${ejemploMdx(c)}`, c.nombre, avisos);

  // ── 1: Portada ────────────────────────────────────────────────────────
  const portada = porNombre('Portada')!;
  pliegos.push(crudo(1, 'portada', portada, nodosEjemplo(portada)));

  // ── 3…: un componente por página ──────────────────────────────────────
  let n = 3;
  for (const c of sueltos) {
    if (c.nombre === 'Pliego') {
      pliegos.push(crudo(n, 'normal', c, nodosDe(c.demo!.hijos ?? '', c.nombre, avisos), { bleed: c.demo!.props.bleed === true }));
    } else if (c.nombre === 'Pagina') {
      const hijos = nodosDe(c.demo!.hijos ?? '', c.nombre, avisos);
      hijos.push({ t: 'html', etiqueta: 'p', clase: 'fz-credito', hijos: [{ t: 'texto', v: P.credito }] });
      pliegos.push(crudo(n, 'normal', c, hijos));
    } else if (c.nombre === 'Foto' || c.nombre === 'FotoCita') {
      // Igual que reemplazarFotos() en sources/piezas.ts, con la foto de pieza_demo.
      const d = c.demo!.props;
      const f = typeof d.foto === 'string' ? P.fotos.find((x) => toAssetPath(x.src) === toAssetPath(String(d.foto))) : P.fotos[Number(d.n ?? 1) - 1];
      if (!f) throw new ErrorExport(`registro.json: la demo de <${c.nombre}> apunta a una foto que no está en pieza_demo.fotos.`);
      const pie = `${d.pie ?? f.pie}${(d.pie ?? f.pie) && !/[.!?]$/.test(String(d.pie ?? f.pie).trim()) ? '.' : ''} Foto: ${f.credito}`.trim();
      const props: Record<string, unknown> = { src: f.src, alt: d.alt ?? f.alt, caption: pie };
      let nombre = c.nombre;
      if (c.nombre === 'FotoCita') {
        props.cita = d.cita;
        if (d.autor != null) props.autor = d.autor;
      } else if (typeof d.foto === 'string') {
        props.ancho = d.ancho ?? 'completo';
      } else {
        const estilo = String(d.estilo ?? 'full');
        nombre = { full: 'ImageFull', side: 'ImageSide', polaroid: 'Polaroid', vieja: 'PhotoOld', xerox: 'Xerox' }[estilo] ?? 'ImageFull';
        if (d.tilt != null) props.tilt = d.tilt;
      }
      pliegos.push(crudo(n, 'normal', c, [{ t: 'componente', nombre, props, hijos: [] }]));
    } else if (c.nombre === 'Relleno') {
      const p = crudo(n, 'relleno', c, []);
      p.relleno = String(c.demo!.props.tipo ?? 'notas');
      pliegos.push(p);
    } else {
      pliegos.push(crudo(n, 'normal', c, nodosEjemplo(c)));
    }
    n++;
  }

  // ── 2: Índice con las páginas reales (primera de cada grupo) ──────────
  const indice = porNombre('Indice')!;
  const items: { page: string; title: string }[] = [];
  for (const comp of componentes) {
    if (comp.pagina < 3) continue;
    const titulo = GRUPOS[comp.grupo as keyof typeof GRUPOS];
    if (!items.some((it) => it.title === titulo)) items.push({ page: String(comp.pagina).padStart(2, '0'), title: titulo });
  }
  const nodosIndice = nodosEjemplo(indice);
  const I = nodosIndice.find((x) => x.t === 'componente' && x.nombre === 'Indice') as any;
  I.props.items = items;
  pliegos.push(crudo(2, 'indice', indice, nodosIndice));

  // ── N-1: Fin (créditos: mascota con su crédito) · N: Contraportada ───
  pliegos.push({ n: N - 1, tipo: 'fin', esquema: null, props: { n: N - 1, tipo: 'fin' }, hijos: [], linea: 0 });
  const contra = porNombre('Contraportada')!;
  pliegos.push(crudo(N, 'contraportada', contra, nodosEjemplo(contra)));
  pliegos.sort((a, b) => a.n - b.n);
  return { pliegos, N, avisos, componentes };
}

export async function exportarKit(salidaDir: string) {
  const { pliegos, N, avisos, componentes } = paginasKit();
  const fuente: FuenteCompuesta = {
    slug: 'kit',
    archivo: ARCHIVO,
    frontmatter: { volume: 0, title: 'Kit de componentes', date: '2026-10-10', author: 'La Jirafa Elektrika', colorScheme: REGISTRO.esquemas_kit[0], prueba: false, impreso: { multimedia: 'qr' }, description: 'Catálogo de componentes del fanzine: cada uno en su versión impresa (Typst).' },
    pliegos,
    avisos,
    creditos: [REGISTRO.pieza_demo.credito],
  };
  const vol = await exportar(fuente, salidaDir);
  // Metadatos del kit para print/kit.typ (cabecera por página) y para build-kit.mjs.
  const ruta = path.join(salidaDir, 'volumen.json');
  const json = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  json.kit = { version: 1, esquemas: REGISTRO.esquemas_kit, paginas: componentes, total: N };
  fs.writeFileSync(ruta, JSON.stringify(json, null, 2));
  return { vol, componentes, N };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const salida = args.includes('--salida') ? args[args.indexOf('--salida') + 1] : 'print/build/kit';
  exportarKit(path.resolve(RAIZ, salida))
    .then(({ vol, componentes, N }) => {
      console.log(`✔ ${ARCHIVO} → ${salida}/volumen.json (${N} páginas, ${componentes.length} componentes, ${vol.fotos.length} fotos, ${vol.qrs.length} QR)`);
      for (const c of componentes) console.log(`  pág. ${String(c.pagina).padStart(2)}  ${c.nombre.padEnd(16)} ${c.esquema.padEnd(8)} ${c.typst}`);
      for (const a of vol.avisos) console.log(`  ⚠ ${a}`);
    })
    .catch((e) => { console.error(`✖ ${e instanceof ErrorExport ? e.message : e.stack ?? e}`); process.exit(1); });
}
