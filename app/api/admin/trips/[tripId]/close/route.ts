import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ tripId: string }> };

// Cerrar / reabrir un viaje (solo ADMIN). Cerrado = el viajero ya no puede
// tocar sus gastos. El status no cambia (Facturas lo lee).
const schema = z.object({ closed: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { closed } = schema.parse(await request.json());
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
    if (!trip) return NextResponse.json({ error: "Viaje no encontrado" }, { status: 404 });
    if (closed && trip.status !== "APROBADO") {
      return NextResponse.json({ error: "Solo se puede cerrar un viaje aprobado" }, { status: 400 });
    }
    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: closed ? { closedAt: new Date(), closedById: session.user.id } : { closedAt: null, closedById: null },
      select: { id: true, closedAt: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    console.error("Error closing trip:", error);
    return NextResponse.json({ error: "Error al cerrar el viaje" }, { status: 500 });
  }
}
