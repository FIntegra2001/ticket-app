// ============================================================================
// Presentación de los partes de gastos de oficina.
//
// Un parte se identifica por mes y año (hay un `@@unique([userId, year, month])`),
// así que su nombre se DERIVA de esos dos campos en vez de escribirse a mano en
// cada vista. `title` existe por si algún día se quiere un nombre libre, y si
// está puesto manda.
// ============================================================================

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function mesNombre(month: number): string {
  return MESES[month - 1] ?? String(month);
}

/**
 * Nombre de carpeta de Cloudinary para un usuario: `Nicolas_Mendoza`.
 *
 * Se usa el nombre y no el `userId` porque estas carpetas las abre gente —
 * financiero revisando los tickets del mes — y un cuid como
 * `cm3k9x2p10000abcd` no dice nada.
 *
 * Se quitan las tildes (NFD + borrar diacríticos) y se sustituye por `_` todo lo
 * que no sea alfanumérico: Cloudinary admite bastantes caracteres en el
 * `public_id`, pero los espacios y las tildes acaban URL-encodados y hacen
 * ilegible la ruta. Fallback en cascada: nombre → parte local del email → id,
 * para que nunca salga una carpeta vacía.
 */
export function userFolderName(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): string {
  const base = user.name?.trim() || user.email?.split("@")[0] || user.id;

  const sinTildes = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const limpio = sinTildes
    .replace(/[^a-zA-Z0-9]+/g, "_") // espacios, puntos, guiones → _
    .replace(/^_+|_+$/g, "") // sin _ al principio ni al final
    .slice(0, 60);

  return limpio || user.id;
}

/** "Octubre 2026", o el `title` si el usuario puso uno. */
export function officeExpenseTitle(parte: {
  title?: string | null;
  month: number;
  year: number;
}): string {
  if (parte.title) return parte.title;
  const nombre = mesNombre(parte.month);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${parte.year}`;
}
