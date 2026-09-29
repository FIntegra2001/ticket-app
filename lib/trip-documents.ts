// ============================================================================
// Documentos del viaje (billete, reserva de hotel): reglas compartidas.
//
// ⚠️ Este módulo es SEGURO EN CLIENTE a propósito: solo constantes y funciones
// puras. Las que hablan con Cloudinary viven en `lib/trip-documents.server.ts`,
// porque el SDK de Cloudinary usa `fs` y, al importarlo desde un componente
// cliente, Next intenta meterlo en el bundle del navegador y el build falla.
//
// ⚠️ Prefijo de Cloudinary: `trip-documents/`, DELIBERADAMENTE fuera de
// `tickets/`. La migración a SharePoint recorre `tickets/{año}/{mes}` y solo eso
// (app/api/admin/migrate-to-sharepoint/route.ts), así que estos ficheros nunca
// entran ahí. Tampoco debe barrerlos la limpieza de Cloudinary de 3 meses: son
// la única copia que existe de un billete.
// ============================================================================

import type { TripDocumentType } from "@/types";

/** Prefijo raíz. Cambiarlo rompería el borrado de ficheros ya subidos. */
export const TRIP_DOCUMENTS_PREFIX = "trip-documents";

/**
 * Tipos aceptados. El PDF es el caso normal (reservas y tarjetas de embarque);
 * las imágenes se admiten porque mucha gente manda una foto o una captura.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * 4 MB. No es un número redondo elegido a capricho: el body de una Vercel
 * Function corta en ~4,5 MB, así que un fichero más grande no llega siquiera al
 * servidor y el error sería opaco. Preferimos rechazarlo con un mensaje claro.
 * Las imágenes se comprimen en el cliente antes de llegar aquí; un PDF no se
 * puede comprimir sin un binario tipo Ghostscript, que no corre en Vercel.
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export const DOCUMENT_TYPE_LABEL: Record<TripDocumentType, string> = {
  BILLETE: "Billete",
  RESERVA: "Reserva de hotel",
  OTRO: "Otro documento",
};

export function isAllowedDocumentMime(mime: string): boolean {
  return (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(mime);
}

/**
 * Carpeta destino: `trip-documents/{año del viaje}/{nº factura o id}`.
 * El año sale de `startDate` (no de la fecha de subida) para que el billete
 * quede archivado con el viaje al que pertenece, aunque se suba en diciembre
 * un viaje de enero.
 */
export function buildDocumentFolder(trip: {
  id: string;
  numberInvoice: string | null;
  startDate: Date;
}): string {
  const year = new Date(trip.startDate).getFullYear();
  const key = trip.numberInvoice
    ? trip.numberInvoice.replace(/[^a-zA-Z0-9-_]/g, "_")
    : trip.id;
  return `${TRIP_DOCUMENTS_PREFIX}/${year}/${key}`;
}

/**
 * `resource_type` de Cloudinary. Hay que usar el mismo al subir y al borrar, o el
 * destroy no encuentra el fichero y deja basura.
 *
 * ⚠️ Los PDF van como **raw**, no como `image`, aunque Cloudinary los clasifique
 * como imagen (sabe rasterizarlos). Motivo comprobado contra la cuenta real: la
 * entrega de PDF por la vía `image` viene DESACTIVADA de fábrica y devuelve 401
 * — también con URL firmada y con `fl_attachment`. Como `raw` se entregan con un
 * 200 sin tocar ningún ajuste de la consola.
 */
export function resourceTypeFor(mime: string): "image" | "raw" {
  if (mime === "application/pdf") return "raw";
  return mime.startsWith("image/") ? "image" : "raw";
}

export type UploadedDocument = {
  url: string;
  publicId: string;
};

/**
 * URL para ver o descargar un documento **a través de la app**, no de Cloudinary.
 *
 * Dos razones para no enlazar la URL de Cloudinary directamente:
 *  1. **Privacidad.** Las URLs de Cloudinary son públicas: cualquiera con el
 *     enlace ve el documento, sin sesión. Una reserva de hotel lleva el nombre y
 *     los datos del viajero. Esta ruta comprueba sesión y asignación.
 *  2. **Content-Type.** Un PDF subido como `raw` se sirve como
 *     `application/octet-stream`, y así el navegador lo descarga en vez de
 *     mostrarlo. La ruta lo reemite como `application/pdf` y el visor funciona.
 */
export function documentFileHref(
  tripId: string,
  documentId: string,
  options: { download?: boolean } = {},
): string {
  const base = `/api/trips/${tripId}/documents/${documentId}/file`;
  return options.download ? `${base}?download=1` : base;
}
