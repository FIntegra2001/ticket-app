import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  buildDocumentFolder,
  isAllowedDocumentMime,
} from "@/lib/trip-documents";
import { uploadTripDocument } from "@/lib/trip-documents.server";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type Params = {
  params: Promise<{ tripId: string }>;
};

const VALID_TYPES = ["BILLETE", "RESERVA", "OTRO"] as const;
type DocType = (typeof VALID_TYPES)[number];

function isValidDocType(value: unknown): value is DocType {
  return (
    typeof value === "string" && (VALID_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Sube un documento al viaje (solo ADMIN). Multipart: `file` + `type`.
 *
 * Los documentos van a `trip-documents/` en Cloudinary, fuera del prefijo
 * `tickets/` que recorre la migración a SharePoint — ver lib/trip-documents.ts.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, numberInvoice: true, startDate: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Falta el fichero a subir" },
        { status: 400 },
      );
    }

    if (!isValidDocType(type)) {
      return NextResponse.json(
        { error: "Tipo de documento no válido (BILLETE, RESERVA u OTRO)" },
        { status: 400 },
      );
    }

    if (!isAllowedDocumentMime(file.type)) {
      return NextResponse.json(
        {
          error: `Formato no admitido (${
            file.type || "desconocido"
          }). Se aceptan PDF, JPG, PNG y WebP.`,
          allowed: ALLOWED_DOCUMENT_TYPES,
        },
        { status: 400 },
      );
    }

    // El límite real lo impone el body de Vercel (~4,5 MB); avisamos antes con un
    // mensaje útil en vez de dejar que la petición muera sin explicación.
    if (file.size > MAX_DOCUMENT_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `El fichero pesa ${mb} MB y el máximo es 4 MB. Si es un PDF escaneado, haz una foto del documento: las imágenes se comprimen automáticamente.`,
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadTripDocument({
      buffer,
      fileName: file.name,
      mimeType: file.type,
      folder: buildDocumentFolder(trip),
    });

    const document = await prisma.tripDocument.create({
      data: {
        tripId,
        type,
        url: uploaded.url,
        publicId: uploaded.publicId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading trip document:", error);
    return NextResponse.json(
      { error: "Error al subir el documento" },
      { status: 500 },
    );
  }
}
