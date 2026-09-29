// ============================================================================
// Parte SERVIDOR de los documentos del viaje: todo lo que toca Cloudinary.
//
// Está separado de `lib/trip-documents.ts` porque el SDK de Cloudinary usa `fs`.
// Si un componente cliente importa (aunque sea solo una constante) de un módulo
// que a su vez importa el SDK, Next intenta empaquetarlo para el navegador y el
// build revienta con "Module not found: Can't resolve 'fs'".
//
// Importar solo desde route handlers.
// ============================================================================

import cloudinary from "@/lib/cloudinary";
import { resourceTypeFor, type UploadedDocument } from "@/lib/trip-documents";

/**
 * Sube el buffer a Cloudinary tal cual.
 *
 * Nota sobre las opciones: NO se pasa `format: "jpg"` ni `transformation`, a
 * diferencia de `upload-receipt`. Con `format: "jpg"` Cloudinary rasterizaría el
 * PDF a la primera página y se perderían las demás — justo lo que no queremos en
 * una reserva de varias noches o un billete de ida y vuelta.
 */
export async function uploadTripDocument(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}): Promise<UploadedDocument> {
  const { buffer, fileName, mimeType, folder } = params;

  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
  const publicId = `${Date.now()}_${safeName || "documento"}`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceTypeFor(mimeType),
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error ?? new Error("Cloudinary no devolvió resultado"));
            return;
          }
          resolve({
            secure_url: uploaded.secure_url,
            public_id: uploaded.public_id,
          });
        },
      )
      .end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Borra un documento de Cloudinary. No lanza: si el fichero ya no está (o
 * Cloudinary falla), preferimos borrar la fila de la BBDD y dejar constancia en
 * el log antes que bloquear la operación del usuario con basura remota.
 */
export async function destroyTripDocument(
  publicId: string,
  mimeType: string,
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceTypeFor(mimeType),
      invalidate: true,
    });
  } catch (error) {
    console.error(
      `No se pudo borrar de Cloudinary el documento ${publicId}:`,
      error,
    );
  }
}
