import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ tripId: string }> };

// Fase 3: seguimiento del hotel. `requested`/`confirmed` = true pone la fecha
// de hoy (o la indicada), false la borra. Solo ADMIN.
const hotelSchema = z.object({
  requested: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const v = hotelSchema.parse(await request.json());
    const when = v.date ? new Date(`${v.date}T12:00:00Z`) : new Date();
    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        ...(v.requested !== undefined && { hotelRequestedAt: v.requested ? when : null }),
        ...(v.confirmed !== undefined && { hotelConfirmedAt: v.confirmed ? when : null }),
      },
      select: { id: true, hotelRequestedAt: true, hotelConfirmedAt: true },
    });
    return NextResponse.json(trip);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    }
    console.error("Error updating hotel status:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
