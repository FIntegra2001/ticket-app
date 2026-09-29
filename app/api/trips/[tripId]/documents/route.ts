import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ tripId: string }>;
};

/**
 * Documentos del viaje (billete, reserva). Lectura para el USER asignado — es el
 * motivo de la feature: que pueda ver su billete sin pedírselo al admin por
 * correo. La subida y el borrado viven en /api/admin/trips/[tripId]/documents.
 */
export async function GET(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    // El USER solo ve los documentos de los viajes que tiene asignados
    const trip = await prisma.trip.findFirst({
      where: isAdmin
        ? { id: tripId }
        : {
            id: tripId,
            assignedUsers: { some: { userId: session.user.id } },
          },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const documents = await prisma.tripDocument.findMany({
      where: { tripId },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching trip documents:", error);
    return NextResponse.json(
      { error: "Error fetching trip documents" },
      { status: 500 },
    );
  }
}
