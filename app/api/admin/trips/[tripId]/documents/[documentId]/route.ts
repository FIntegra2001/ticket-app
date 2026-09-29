import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { destroyTripDocument } from "@/lib/trip-documents.server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ tripId: string; documentId: string }>;
};

/** Borra un documento del viaje: primero el fichero en Cloudinary, luego la fila. */
export async function DELETE(_: Request, { params }: Params) {
  try {
    const { tripId, documentId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.tripDocument.findFirst({
      where: { id: documentId, tripId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Documento no encontrado" },
        { status: 404 },
      );
    }

    // destroyTripDocument no lanza: si el fichero ya no está en Cloudinary,
    // seguimos adelante y borramos la fila igualmente.
    await destroyTripDocument(document.publicId, document.mimeType);

    await prisma.tripDocument.delete({ where: { id: documentId } });

    return NextResponse.json({ ok: true, message: "Documento eliminado" });
  } catch (error) {
    console.error("Error deleting trip document:", error);
    return NextResponse.json(
      { error: "Error al eliminar el documento" },
      { status: 500 },
    );
  }
}
