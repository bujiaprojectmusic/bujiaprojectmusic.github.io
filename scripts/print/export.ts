// Export del contenido de Astro al JSON del impreso (issue #9):
//   npx tsx scripts/print/export.ts                 → todos los volúmenes (fanzine: true, sin draft)
//   npx tsx scripts/print/export.ts --fixture tests/print/fixtures/x.mdx [--salida print/build/fixtures/x]
// Escribe print/build/<slug>/volumen.json (+ qr/*.svg). No publica
// consentimiento_ref, redes ni piezas draft; el JSON no va a dist/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { listarVolumenes, leerFuente, volumeSlug, type FuenteVolumen } from './sources/posts.ts';
import { parsearMdx, leerImports, pliegos as leerPliegos, ErrorExport, type Contexto, type PliegoCrudo } from './lib/mdx.ts';
import type { Volumen, Pliego, Foto, Nodo } from './lib/tipos.ts';
import { colorSchemes, taller as sitioTaller } from '../../src/config/site.ts';
import * as taller from '../../src/data/taller.ts';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const reglas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'print', 'reglas.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'print', 'componentes.json'), 'utf8'));
const CAJA = reglas.margenes.caja_texto.ancho_pt as number;
const SITIO = (fs.readFileSync(path.join(RAIZ, 'astro.config.mjs'), 'utf8').match(/site:\s*'([^']+)'/) ?? [])[1] ?? 'https://bujiaprojectmusic.com';

const rel = (p: string) => path.relative(RAIZ, p).split(path.sep).join('/');

/** "/img/x.jpg" → src/assets/img/x.jpg; "/fanzine/vol-00/x" → src/assets/fanzine/vol-00/x; "./x" → junto al MDX. */
function rutaMaster(src: string, archivoMdx: string): string {
  if (src.startsWith('/img/')) return path.join(RAIZ, 'src', 'assets', 'img', src.slice(5));
  if (src.startsWith('/fanzine/')) return path.join(RAIZ, 'src', 'assets', 'fanzine', src.slice(9));
  if (src.startsWith('./') || src.startsWith('../')) return path.resolve(RAIZ, path.dirname(archivoMdx), src);
  return path.join(RAIZ, src.replace(/^\//, ''));
}

async function cargarFoto(fotos: Map<string, Foto>, src: string, archivoMdx: string, avisos: string[], contexto: string): Promise<Foto> {
  const master = rutaMaster(src, archivoMdx);
  const id = crypto.createHash('sha1').update(rel(master)).digest('hex').slice(0, 12);
  if (fotos.has(id)) return fotos.get(id)!;
  let foto: Foto;
  if (!fs.existsSync(master)) {
    avisos.push(`${contexto}: no existe la imagen "${src}" (se esperaba en ${rel(master)}); va un recuadro "imagen pendiente".`);
    foto = { id, master: rel(master), ancho_px: 0, alto_px: 0, formato: path.extname(master).slice(1).toLowerCase(), existe: false, usos: [] };
  } else {
    const m = await sharp(master).metadata();
    const girada = (m.orientation ?? 1) >= 5;
    foto = { id, master: rel(master), ancho_px: girada ? m.height! : m.width!, alto_px: girada ? m.width! : m.height!, formato: m.format ?? path.extname(master).slice(1).toLowerCase(), existe: true, usos: [] };
  }
  fotos.set(id, foto);
  return foto;
}

/** Ancho colocado (pt) de una imagen según el componente que la muestra. */
function anchoColocado(componente: string, props: Record<string, any>, foto: Foto, n: number): number {
  const pct = (v: number) => (CAJA * v) / 100;
  const CAJA_H = reglas.margenes.caja_texto.alto_pt as number;
  // Igual que ancho-ajustado() en print/lib/componentes/util.typ.
  const ajustado = (wmax: number, altoMaxPct: number | undefined) =>
    !foto.existe || altoMaxPct == null || !foto.alto_px ? wmax : Math.min(wmax, (CAJA_H * altoMaxPct / 100) * foto.ancho_px / foto.alto_px);
  switch (componente) {
    case 'Portada':
    case 'Pliego': {
      // Foto a sangre, recorte "cover" sobre el BleedBox.
      const bw = reglas.formato.bleedbox.ancho_pt, bh = reglas.formato.bleedbox.alto_pt;
      if (!foto.existe) return bw;
      const s = Math.max(bw / foto.ancho_px, bh / foto.alto_px);
      return foto.ancho_px * s;
    }
    case 'ImageFull': return ajustado(pct(geo.image_full.ancho_pct), geo.image_full.alto_max_pct);
    case 'Xerox': return ajustado(pct(geo.xerox.ancho_pct) - 2 * geo.xerox.marco_pt, geo.xerox.alto_max_pct);
    case 'Polaroid': return ajustado(pct(geo.polaroid.ancho_pct) - 2 * geo.polaroid.marco_pt, geo.polaroid.alto_max_pct);
    case 'PhotoOld': return ajustado(pct(geo.photo_old.ancho_pct) - 2 * geo.photo_old.marco_pt, geo.photo_old.alto_max_pct);
    case 'ImageSide': {
      const w = String(props.width ?? `${geo.image_side.ancho_pct_default}%`);
      return ajustado(w.endsWith('%') ? pct(parseFloat(w)) : parseFloat(w) * geo.optimized_image.px_a_pt, geo.image_side.alto_max_pct);
    }
    case 'Gallery': {
      const cols = Math.min(n, geo.gallery.columnas_max);
      return ajustado((CAJA - (cols - 1) * geo.gallery.separacion_pt) / cols, geo.gallery.alto_max_pct);
    }
    case 'BeforeAfter': return (CAJA - geo.before_after.separacion_pt) / 2;
    case 'OptimizedImage': return ajustado(Math.min(CAJA, Number(props.width ?? geo.mascota.ancho_pt_default) * geo.optimized_image.px_a_pt), geo.optimized_image.alto_max_pct);
    default: return CAJA;
  }
}

const PROPS_IMAGEN: Record<string, string[]> = {
  Portada: ['image'], ImageFull: ['src'], ImageSide: ['src'], Polaroid: ['src'], PhotoOld: ['src'], Xerox: ['src'],
  OptimizedImage: ['src'], BeforeAfter: ['before', 'after'], Pliego: ['bleed'],
};

function urlVideo(props: Record<string, any>): string {
  return props.kind === 'playlist' ? `https://www.youtube.com/playlist?list=${props.id}` : `https://www.youtube.com/watch?v=${props.id}`;
}

export async function exportar(fuente: FuenteVolumen, salidaDir: string): Promise<Volumen> {
  const fm = fuente.frontmatter;
  const avisos: string[] = [];
  const tree = parsearMdx(fuente.cuerpo);
  const { componentes, taller: idsTaller } = leerImports(tree);
  const datos = new Map<string, unknown>();
  for (const id of idsTaller) {
    if (!(id in taller)) throw new ErrorExport(`${fuente.archivo}: importa \`${id}\` de src/data/taller.ts, que no existe.`);
    datos.set(id, (taller as any)[id]);
  }
  const slug = fuente.slug;
  const urlVol = `${SITIO}/fanzine/${slug}`;
  const paginaDeLiga = (url: string): number | null => {
    const m = url.match(/^(?:\/fanzine\/vol-(\d+))?#pagina-(\d+)$/) ?? url.match(new RegExp(`^${SITIO}/fanzine/vol-(\\d+)#pagina-(\\d+)$`));
    if (!m) return null;
    if (m[1] != null && volumeSlug(Number(m[1])) !== slug) return null;
    return Number(m[2]);
  };
  const ctx: Contexto = { archivo: fuente.archivo, lineaBase: fuente.lineaBase, componentes, datos, paginaDeLiga, avisos };
  const crudos = leerPliegos(ctx, tree);

  // ── Mapa de páginas: N = mayor n; faltantes → relleno diseñado ─────────
  const porN = new Map<number, PliegoCrudo>();
  for (const p of crudos) {
    if (porN.has(p.n)) throw new ErrorExport(`${fuente.archivo}:${p.linea}: <Pliego n={${p.n}}> repetido.`);
    porN.set(p.n, p);
  }
  const N = Math.max(...porN.keys());
  const P = reglas.paginas;
  const errores: string[] = [];
  if (N < P.minimo) errores.push(`${N} páginas: el mínimo es ${P.minimo}.`);
  if (N % P.multiplo !== 0) {
    const sig = Math.ceil(N / P.multiplo) * P.multiplo;
    errores.push(`${N} páginas no es múltiplo de ${P.multiplo}: el volumen no cierra. Faltan ${sig - N} páginas (→ ${sig}): agregá piezas o <Pliego tipo="relleno"> antes del Fin, y mové Fin a la ${sig - 1} y contraportada a la ${sig}.`);
  }
  const tipoDe = (n: number) => porN.get(n)?.tipo;
  if (tipoDe(1) !== 'portada') errores.push(`la página 1 tiene que ser tipo="portada" (es "${tipoDe(1) ?? 'nada'}").`);
  if (tipoDe(2) !== 'indice') errores.push(`la página 2 tiene que ser tipo="indice" (es "${tipoDe(2) ?? 'nada'}").`);
  if (tipoDe(N - 1) !== 'fin') errores.push(`la página ${N - 1} (N-1) tiene que ser tipo="fin" (es "${tipoDe(N - 1) ?? 'nada'}").`);
  if (tipoDe(N) !== 'contraportada') errores.push(`la página ${N} (N) tiene que ser tipo="contraportada" (es "${tipoDe(N) ?? 'nada'}").`);
  for (const p of crudos) {
    if (p.tipo === 'fin' && p.n !== N - 1) errores.push(`el Fin está en la página ${p.n}, pero el volumen cierra en ${N}: tiene que ir en la ${N - 1}. Hay piezas después del Fin: el volumen no cierra.`);
    if (p.tipo === 'contraportada' && p.n !== N) errores.push(`la contraportada está en la página ${p.n}; tiene que ser la última (${N}).`);
    if ((p.tipo === 'normal' || p.tipo === 'relleno') && (p.n < 3 || p.n > N - 2)) errores.push(`la página ${p.n} (${p.tipo}) cae fuera de 3…${N - 2}.`);
  }
  if (errores.length) throw new ErrorExport(`${fuente.archivo}: el volumen no cierra:\n  - ${errores.join('\n  - ')}`);
  if (N > P.aviso_mas_de) avisos.push(`${N} páginas: más de ${P.aviso_mas_de} (costo de tinta, peso, grapas). No bloquea.`);

  // ── Fotos, QR, multimedia ──────────────────────────────────────────────
  const multimedia: 'qr' | 'omitir' = fm.impreso?.multimedia === 'omitir' ? 'omitir' : 'qr';
  const fotos = new Map<string, Foto>();
  const qrs: Volumen['qrs'] = [];
  fs.mkdirSync(path.join(salidaDir, 'qr'), { recursive: true });
  const qr = async (url: string) => {
    const id = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
    if (!qrs.some((q) => q.id === id)) {
      const archivo = path.join(salidaDir, 'qr', `${id}.svg`);
      fs.writeFileSync(archivo, await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } }));
      qrs.push({ id, url, archivo: '/' + rel(archivo) });
    }
    return id;
  };
  const fotografos = new Set<string>();

  async function procesar(nodos: Nodo[], n: number): Promise<Nodo[]> {
    const out: Nodo[] = [];
    for (const nodo of nodos) {
      if (nodo.t === 'componente') {
        const props = { ...nodo.props } as Record<string, any>;
        if (['VideoPoster', 'VideoOldTV', 'VideoCinema'].includes(nodo.nombre)) {
          if (multimedia === 'omitir') { avisos.push(`pág. ${n}: <${nodo.nombre} id="${props.id}"> omitido (impreso.multimedia = "omitir").`); continue; }
          props.url = urlVideo(props);
          props.qr = await qr(props.url);
          props.kind = props.kind ?? 'video';
          out.push({ ...nodo, nombre: 'VideoPoster', props, hijos: await procesar(nodo.hijos, n) });
          continue;
        }
        for (const k of PROPS_IMAGEN[nodo.nombre] ?? []) {
          if (typeof props[k] === 'string') {
            const foto = await cargarFoto(fotos, props[k], fuente.archivo, avisos, `${fuente.archivo} pág. ${n} <${nodo.nombre}>`);
            foto.usos.push({ pliego: n, componente: nodo.nombre, ancho_pt: anchoColocado(nodo.nombre, props, foto, 1) });
            props[k] = foto.id;
          }
        }
        if (nodo.nombre === 'Gallery' && Array.isArray(props.images)) {
          const imgs = [] as any[];
          for (const im of props.images) {
            const foto = await cargarFoto(fotos, String(im.src), fuente.archivo, avisos, `${fuente.archivo} pág. ${n} <Gallery>`);
            foto.usos.push({ pliego: n, componente: 'Gallery', ancho_pt: anchoColocado('Gallery', props, foto, props.images.length) });
            imgs.push({ ...im, src: foto.id });
          }
          props.images = imgs;
        }
        for (const k of ['caption']) {
          const m = typeof props[k] === 'string' ? props[k].match(/Foto:\s*([^.]+)/) : null;
          if (m) fotografos.add(m[1].trim());
        }
        out.push({ ...nodo, props, hijos: await procesar(nodo.hijos, n) });
      } else if ('hijos' in nodo) {
        out.push({ ...nodo, hijos: await procesar(nodo.hijos, n) } as Nodo);
      } else if (nodo.t === 'lista') {
        const items = [] as Nodo[][];
        for (const it of nodo.items) items.push(await procesar(it, n));
        out.push({ ...nodo, items });
      } else out.push(nodo);
    }
    return out;
  }

  // ── Pliegos finales (1…N) ──────────────────────────────────────────────
  const pliegos: Pliego[] = [];
  let relleno = 0;
  for (let n = 1; n <= N; n++) {
    const c = porN.get(n);
    if (!c || (c.tipo === 'relleno' && !c.hijos.length)) {
      const tipoRelleno = geo.relleno.orden[relleno++ % geo.relleno.orden.length];
      if (!c) avisos.push(`pág. ${n}: no hay <Pliego n={${n}}>; va una página de relleno diseñada (${tipoRelleno}).`);
      else avisos.push(`pág. ${n}: <Pliego tipo="relleno">; va una página de relleno diseñada (${tipoRelleno}).`);
      pliegos.push({ n, tipo: 'relleno', esquema: null, relleno: tipoRelleno, nodos: [] });
      continue;
    }
    const nodos = await procesar(c.hijos, n);
    if (typeof c.props.bleed === 'string') {
      const foto = await cargarFoto(fotos, c.props.bleed, fuente.archivo, avisos, `${fuente.archivo} pág. ${n} <Pliego bleed>`);
      foto.usos.push({ pliego: n, componente: 'Pliego', ancho_pt: anchoColocado('Pliego', c.props, foto, 1) });
      (c.props as any).bleed = foto.id;
    }
    pliegos.push({ n, tipo: c.tipo as Pliego['tipo'], esquema: c.esquema, nodos, origen: { archivo: fuente.archivo, linea: c.linea }, ...(typeof c.props.bleed === 'string' ? { bleed: c.props.bleed } : {}) } as Pliego);
  }

  // ── Índice (página 2) ──────────────────────────────────────────────────
  const indiceNodo = pliegos[1].nodos.find((x) => x.t === 'componente' && x.nombre === 'Indice') as any;
  const indice = (indiceNodo?.props?.items ?? []).map((it: any) => ({ pagina: parseInt(String(it.page), 10), titulo: String(it.title) }));
  for (const it of indice) {
    if (!Number.isInteger(it.pagina) || it.pagina < 3 || it.pagina > N - 1) throw new ErrorExport(`${fuente.archivo}: el índice apunta a la página ${it.pagina} ("${it.titulo}"), fuera de 3…${N - 1}.`);
    if (pliegos[it.pagina - 1].tipo === 'relleno') avisos.push(`índice: "${it.titulo}" apunta a la pág. ${it.pagina}, que todavía es de relleno (TODO en el MDX).`);
  }
  if (indiceNodo) indiceNodo.props.items = indice.map((it: any) => ({ page: it.pagina, title: it.titulo }));

  // Mascota y logo (portada, fin, contraportada) y QR del volumen.
  const mascota = await cargarFoto(fotos, geo.mascota.archivo, fuente.archivo, avisos, 'mascota');
  mascota.usos.push({ pliego: 1, componente: 'Portada', ancho_pt: Math.max(geo.portada.mascota_ancho_pt, geo.contraportada.mascota_ancho_pt, geo.fin.mascota_ancho_pt) });
  const logo = await cargarFoto(fotos, geo.logo.archivo, fuente.archivo, avisos, 'logo');
  logo.usos.push({ pliego: N, componente: 'DatosTaller', ancho_pt: geo.contraportada.logo_ancho_pt });
  const qrVolumen = await qr(urlVol);
  const qrColabora = await qr(`${SITIO}${geo.relleno.colabora_url}`);

  const fecha = fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date);
  const vol: Volumen = {
    version: 1,
    slug,
    volumen: fm.volume,
    titulo: String(fm.title),
    fecha,
    autor: String(fm.author ?? 'Ripper'),
    descripcion: fm.description,
    esquema: String(fm.colorScheme ?? 'negro'),
    prueba: !!fm.prueba,
    multimedia,
    url: urlVol,
    sitio: SITIO,
    paginas: N,
    fijas: { portada: 1, indice: 2, fin: N - 1, contraportada: N, pliegoCentral: [N / 2, N / 2 + 1] },
    indice,
    paleta: colorSchemes as any,
    pliegos,
    fotos: [...fotos.values()],
    qrs,
    avisos,
    origen: fuente.archivo,
    ...({ mascota: mascota.id, logo: logo.id, qr_volumen: qrVolumen, qr_colabora: qrColabora, creditos: { autor: String(fm.author ?? 'Ripper'), fotografos: [...fotografos], mascota: geo.mascota.credito }, taller: { direccion: taller.direccionTexto, horario: taller.horario.map((h) => ({ dias: h.dias, texto: h.texto })), whatsapp: taller.whatsapp.numeroTexto, web: SITIO.replace(/^https?:\/\//, ''), servicios: { titulo: sitioTaller.catalog.title, subtitulo: sitioTaller.catalog.subtitle }, anuncios: [...sitioTaller.announcementBar.messages] } } as any),
  };
  fs.mkdirSync(salidaDir, { recursive: true });
  fs.writeFileSync(path.join(salidaDir, 'volumen.json'), JSON.stringify(vol, null, 2));
  return vol;
}

async function main() {
  const args = process.argv.slice(2);
  const fixture = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
  const salida = args.includes('--salida') ? args[args.indexOf('--salida') + 1] : null;
  const fuentes = fixture ? [leerFuente(RAIZ, fixture)] : listarVolumenes(RAIZ);
  if (!fuentes.length) { console.log('(no hay volúmenes con fanzine: true)'); return; }
  for (const f of fuentes) {
    const dir = salida ? path.resolve(RAIZ, salida) : path.join(RAIZ, 'print', 'build', f.slug);
    const v = await exportar(f, dir);
    console.log(`✔ ${f.archivo} → ${rel(dir)}/volumen.json (${v.paginas} páginas, ${v.fotos.length} fotos, ${v.qrs.length} QR, multimedia=${v.multimedia})`);
    for (const a of v.avisos) console.log(`  ⚠ ${a}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`✖ ${e instanceof ErrorExport ? e.message : e.stack ?? e}`); process.exit(1); });
}
