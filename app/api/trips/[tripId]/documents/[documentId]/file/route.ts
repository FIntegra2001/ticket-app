import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type Params = {
  params: Promise<{ tripId: string; documentId: string }>;
};

/**
 * Sirve el fichero de un documento del viaje a través de la app.
 *
 * ¿Por qué no enlazar directamente la URL de Cloudinary?
 *
 * 1. **Privacidad.** Las URLs de Cloudinary son públicas y adivinables por quien
 *    tenga el enlace: no piden sesión. Una reserva de hotel o un billete llevan
 *    nombre, DNI y datos de contacto del viajero. Aquí se comprueba que quien
 *    pide el fichero es el usuario asignado al viaje o un admin.
 *
 * 2. **Content-Type.** Los PDF se suben como `raw` porque la entrega vía `image`
 *    está desactivada en la cuenta (devuelve 401). Cloudinary sirve los `raw`
 *    como `application/octet-stream`, así que el navegador los descargaría en vez
 *    de mostrarlos. Aquí se reemiten con su tipo real y el visor funciona.
 *
 * `?download=1` fuerza la descarga con el nombre original del fichero.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { tripId, documentId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    const document = await prisma.tripDocument.findFirst({
      where: {
        id: documentId,
        tripId,
        // El USER solo accede a documentos de viajes que tiene asignados
        ...(isAdmin
          ? {}
          : { trip: { assignedUsers: { some: { userId: session.user.id } } } }),
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Documento no encontrado" },
        { status: 404 },
      );
    }

    const upstream = await fetch(document.url);

    if (!upstream.ok || !upstream.body) {
      console.error(
        `Cloudinary devolvió ${upstream.status} para ${document.publicId}`,
      );
      return NextResponse.json(
        { error: "No se pudo recuperar el fichero" },
        { status: 502 },
      );
    }

    const download = request.nextUrl.searchParams.get("download") === "1";
    // El nombre va entre comillas y sin comillas internas, que romperían la cabecera
    const safeName = document.fileName.replace(/["\\]/g, "");

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.size),
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${safeName}"`,
        // Privado: es un documento personal, que no lo cachee ningún proxy
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error serving trip document:", error);
    return NextResponse.json(
      { error: "Error al recuperar el documento" },
      { status: 500 },
    );
  }
}
