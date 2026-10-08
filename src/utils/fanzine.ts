// URL de los volúmenes del fanzine (decisión del 8 oct en #6): cada
// volumen vive en /fanzine/vol-NN (dos dígitos), y el slug sale del
// número de volumen, no del título ni del nombre del archivo. Las URLs
// viejas (/blog/<archivo>, /fanzine/<archivo>) redirigen a la nueva.
import type { CollectionEntry } from 'astro:content';

export function volumeSlug(volume: number): string {
  return `vol-${String(volume).padStart(2, '0')}`;
}

/** Slug de la URL de un post fanzine: "vol-01". */
export function fanzineSlug(post: CollectionEntry<'posts'>): string {
  if (post.data.volume == null) {
    throw new Error(
      `${post.id}: un post con fanzine: true necesita \`volume\` en el frontmatter (la URL es /fanzine/vol-NN).`,
    );
  }
  return volumeSlug(post.data.volume);
}

/** Ruta absoluta (con base) de un volumen: "/fanzine/vol-01". */
export function fanzinePath(post: CollectionEntry<'posts'>): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/fanzine/${fanzineSlug(post)}`;
}
