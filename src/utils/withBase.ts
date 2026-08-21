// Antepone el "base" del sitio (p. ej. "/bujia-project-music") a una ruta
// que empieza en "/", para que funcione tanto en local (base "/") como en
// GitHub Pages (base "/nombre-repo/"). Las rutas absolutas (http/https) y
// las que ya vienen con base no se tocan.
export function withBase(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && src.startsWith(`${base}/`)) return src;
  return `${base}${src}`;
}
