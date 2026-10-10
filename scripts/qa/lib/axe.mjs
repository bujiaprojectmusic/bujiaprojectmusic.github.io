// Accesibilidad con @axe-core/playwright (issue #14, alcance 5): /fanzine,
// /fanzine/colabora, /volumenes y cada volumen, a 390 y 1280 px. serious y
// critical fallan; moderate/minor van como aviso al resumen.
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { servirDist } from './servidor.mjs';
import { leerVolumenes } from './contenido.mjs';

export function paginasAxe({ dist, contenido = 'src/content' }) {
  const rutas = ['/fanzine', '/fanzine/colabora', '/volumenes'];
  if (fs.existsSync(path.join(dist, 'fanzine', 'colabora', 'enviar', 'index.html'))) rutas.push('/fanzine/colabora/enviar');
  for (const v of leerVolumenes(contenido)) if (fs.existsSync(path.join(dist, 'fanzine', v.slug, 'index.html'))) rutas.push(`/fanzine/${v.slug}`);
  return rutas;
}

export async function revisarAccesibilidad({ dist, contenido = 'src/content', rutas, anchos = [390, 1280], chromiumPath = process.env.PW_CHROMIUM || undefined }) {
  rutas = rutas ?? paginasAxe({ dist, contenido });
  const { base, cerrar } = await servirDist(dist);
  const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });
  const errores = [];
  const avisos = [];
  const detalles = [];
  try {
    for (const ruta of rutas) {
      for (const w of anchos) {
        const context = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 800 } });
        const page = await context.newPage();
        const res = await page.goto(base + ruta, { waitUntil: 'load' });
        if (!res || res.status() >= 400) {
          errores.push({ archivo: ruta, mensaje: `no cargó (${res?.status() ?? 'sin respuesta'})` });
          await context.close();
          continue;
        }
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        let graves = 0;
        for (const v of r.violations) {
          const nodos = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' ; ');
          const item = { archivo: `${ruta} @ ${w}px`, selector: nodos, mensaje: `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodo${v.nodes.length === 1 ? '' : 's'}) ${v.helpUrl}` };
          if (v.impact === 'serious' || v.impact === 'critical') {
            graves++;
            errores.push(item);
          } else avisos.push(item);
        }
        detalles.push(`${ruta} @ ${w}px: ${r.violations.length} violaciones (${graves} graves), ${r.passes.length} reglas ok`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    cerrar();
  }
  return { nombre: 'Accesibilidad (axe)', estado: errores.length ? 'error' : avisos.length ? 'aviso' : 'ok', resumen: `${rutas.length} páginas × ${anchos.length} anchos · ${errores.length} graves, ${avisos.length} menores`, errores, avisos, detalles };
}
