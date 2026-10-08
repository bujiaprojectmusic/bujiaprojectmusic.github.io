// ─────────────────────────────────────────────────────────────────────────
// Datos del local del taller: dirección, horario, WhatsApp y mapa.
// ÚNICO lugar donde se escriben. Todo lo que los muestra (footer de
// TallerLayout y BaseLayout, bloque "Dónde estamos" de /nosotros, JSON-LD
// de schema.org) los importa de acá, así que el próximo cambio de local
// u horario se hace en este archivo y nada más.
// Datos confirmados por Ricardo el 8 oct 2026 (issue #18).
// ─────────────────────────────────────────────────────────────────────────

export const direccion = {
  calle: 'Abasolo 105',
  colonia: 'Col. del Carmen',
  ciudad: 'Texcoco',
  estado: 'Estado de México',
  pais: 'México',
  paisISO: 'MX',
  // Código postal: no confirmado todavía; se deja fuera a propósito (no
  // inventar). Cuando Ricardo lo pase, agregar `cp: '…'` acá y se usa solo
  // en el texto, el JSON-LD y la búsqueda del mapa.
  cp: undefined as string | undefined,
};

/** "Abasolo 105, Col. del Carmen, Texcoco, Estado de México" */
export const direccionTexto = [direccion.calle, direccion.colonia, direccion.ciudad, direccion.estado]
  .concat(direccion.cp ? [`C.P. ${direccion.cp}`] : [])
  .join(', ');

// Búsqueda por dirección (sin coordenadas ni place id inventados).
const consultaMapa = encodeURIComponent(`${direccionTexto}, ${direccion.pais}`);
export const mapa = {
  /** Liga a Google Maps. */
  url: `https://www.google.com/maps/search/?api=1&query=${consultaMapa}`,
  /** Mapa incrustable (iframe), también por búsqueda de dirección. */
  embedUrl: `https://www.google.com/maps?q=${consultaMapa}&output=embed`,
};

// Horario en formato estructurado (24 h) + texto para mostrar. Los
// bloques se agrupan como los escribe Ricardo: L–J, V, S; domingo cerrado.
export interface BloqueHorario {
  dias: string; // texto
  diasSchema: string[]; // schema.org DayOfWeek
  abre?: string; // "10:00" (24 h); sin abre/cierra = cerrado
  cierra?: string;
  texto: string; // "10:00 a.m. – 6:00 p.m." | "Cerrado"
}
export const horario: BloqueHorario[] = [
  { dias: 'Lunes a jueves', diasSchema: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], abre: '10:00', cierra: '18:00', texto: '10:00 a.m. – 6:00 p.m.' },
  { dias: 'Viernes', diasSchema: ['Friday'], abre: '10:00', cierra: '17:00', texto: '10:00 a.m. – 5:00 p.m.' },
  { dias: 'Sábado', diasSchema: ['Saturday'], abre: '10:00', cierra: '15:30', texto: '10:00 a.m. – 3:30 p.m.' },
  { dias: 'Domingo', diasSchema: ['Sunday'], texto: 'Cerrado' },
];

/** Horario en una línea: "Lun a jue 10:00 a.m. – 6:00 p.m. · Vie … · Sáb … · Dom cerrado" */
export const horarioTexto = horario
  .map((b) => `${b.dias.replace('Lunes a jueves', 'Lun a jue').replace('Viernes', 'Vie').replace('Sábado', 'Sáb').replace('Domingo', 'Dom')} ${b.texto.toLowerCase() === 'cerrado' ? 'cerrado' : b.texto}`)
  .join(' · ');

// WhatsApp: no cambia (56 1862 2447).
export const whatsapp = {
  numero: '5618622447',
  numeroTexto: '56 1862 2447',
  /** Formato E.164 (México +52) para tel: y JSON-LD. */
  e164: '+525618622447',
  /** Liga oficial (no cambia). */
  url: 'https://wa.me/message/PRMKHTDNWYD3I1',
};

export const contacto = {
  email: 'bujiaprojectmusic@gmail.com',
};
