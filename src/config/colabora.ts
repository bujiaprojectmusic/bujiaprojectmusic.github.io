// ─────────────────────────────────────────────────────────────────────────
// Envío de colaboraciones al fanzine (issue #12): la plantilla del correo,
// el asunto, la tabla de campos y el texto de permisos. ÚNICA definición:
// de acá salen el <pre> para copiar y el enlace mailto: del botón "Mandar
// mi colaboración" (src/pages/fanzine/colabora/enviar.astro), así nunca se
// desincronizan. Textos copia fiel del issue #12 (doc "Plantilla para
// colaboradores", 8 oct 2026); si el doc cambia tras la revisión legal, se
// actualiza acá. El flag de publicación y el correo están en site.ts.
// ─────────────────────────────────────────────────────────────────────────
import { fanzine } from './site';

export const CORREO = fanzine.colabora.correo;

/** Asunto del correo: el colaborador reemplaza <título de tu pieza>. */
export const ASUNTO = '[Jirafa] <título de tu pieza>';

/** Cuerpo del correo / contenido del <pre>. Saltos de línea \n. */
export const PLANTILLA = `Título:
Sección: (crónica de taller / entrevista / reseña / fotoensayo / opinión / DIY)
Autor/crédito:
Bio (máx. 280 caracteres):
Redes (opcional):
Contacto (no se publica):

Texto:


Fotos (una línea por foto):
- Archivo: | Pie: | Crédito: | ¿Personas identificables? sí/no

Links para fotos pesadas:

Permisos: escribe "Acepto" si estás de acuerdo con los permisos de publicación de bujiaprojectmusic.com/fanzine/colabora
Acepto:`;

/**
 * mailto: armado en build (RFC 6068): subject y body con encodeURIComponent,
 * saltos de línea como %0D%0A.
 */
export function mailtoColabora(): string {
  const cuerpo = PLANTILLA.replace(/\r?\n/g, '\r\n');
  return `mailto:${CORREO}?subject=${encodeURIComponent(ASUNTO)}&body=${encodeURIComponent(cuerpo)}`;
}

/** Tabla de campos de la plantilla; `publica` = ¿se publica? */
export const CAMPOS: { campo: string; que: string; publica: boolean }[] = [
  { campo: 'Título', que: 'El título de tu pieza (va también en el asunto del correo).', publica: true },
  { campo: 'Sección', que: 'Crónica de taller, entrevista, reseña, fotoensayo, opinión o DIY.', publica: true },
  { campo: 'Autor/crédito', que: 'Cómo quieres aparecer: nombre, seudónimo o colectivo.', publica: true },
  { campo: 'Bio', que: 'Máximo 280 caracteres.', publica: true },
  { campo: 'Redes', que: 'Opcional: Instagram, Bandcamp, lo que quieras ligar.', publica: true },
  { campo: 'Contacto', que: 'Correo o WhatsApp para hablar contigo sobre la pieza.', publica: false },
  { campo: 'Texto', que: 'En el cuerpo del correo o adjunto (.docx o Google Doc).', publica: true },
  { campo: 'Fotos', que: 'Adjuntas (máx. 25 MB en total), tamaño original, sin filtros ni recortes; una línea por foto con pie, crédito y si hay personas identificables.', publica: true },
  { campo: 'Links para fotos pesadas', que: 'Drive, WeTransfer o similar si las fotos pesan más de 25 MB.', publica: true },
  { campo: 'Permisos', que: 'Escribe "Acepto" si estás de acuerdo con los permisos de publicación.', publica: false },
];

/** Permisos de publicación y consentimiento (BORRADOR, pendiente de revisión legal). */
export const PERMISOS_INTRO = 'Al escribir "Acepto" en tu correo:';
export const PERMISOS: { titulo: string; texto: string }[] = [
  { titulo: 'Conservas tus derechos.', texto: 'Tú sigues siendo el autor y dueño de tu texto y tus fotos.' },
  { titulo: 'Permiso no exclusivo.', texto: 'Le das a Bujía Project Music permiso no exclusivo para publicar tu texto y tus fotos en La Jirafa Elektrika: en el sitio web y en los PDF descargables e impresos del fanzine, siempre con tu crédito. Puedes seguir publicando tu material donde quieras.' },
  { titulo: 'Obra propia o con permiso.', texto: 'Declaras que el texto y las fotos son tuyos o que tienes permiso de sus autores para mandarlos y publicarlos.' },
  { titulo: 'Personas identificables.', texto: 'Si en las fotos aparecen personas que se pueden reconocer, declaras que esas personas aceptaron salir publicadas.' },
  { titulo: 'Menores de edad.', texto: 'Las fotos de menores solo se publican con permiso de su madre, padre o tutor.' },
  { titulo: 'Edición.', texto: 'Podemos editar el texto por extensión, estilo y formato del fanzine; si el cambio es de fondo, te consultamos antes.' },
  { titulo: 'Selección.', texto: 'Enviar material no garantiza que se publique; te avisamos si tu pieza entra a un volumen.' },
  { titulo: 'Tus datos.', texto: 'Tu contacto solo se usa para hablar contigo sobre tu colaboración y no se publica.' },
];
export const PERMISOS_CIERRE = 'Escribe "Acepto" en el campo de permisos para confirmar.';
