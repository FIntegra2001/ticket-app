import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { updateStatusSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ tripId: string }>;
};

// ✅ Include reutilizable
const tripInclude = {
  assignedUsers: {
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  },
  expenses: {
    orderBy: { date: "desc" as const },
  },
} as const;

export async function PUT(request: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status } = updateStatusSchema.parse(body);

    // 🆕 Comprobar existencia antes de actualizar: sin esto, un tripId inválido
    // reventaba con un P2025 convertido en 500 en vez de un 404 limpio.
    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 🆕 Sello de aprobación: se pone al aprobar y se limpia al salir de APROBADO,
    // para que el Excel de resumen no muestre una aprobación que ya no existe.
    const trip = await prisma.trip.update({
      where: { id: tripId },
      data:
        status === "APROBADO"
          ? {
              status,
              approvedAt: new Date(),
              approvedById: session.user.id,
            }
          : { status, approvedAt: null, approvedById: null },
      include: tripInclude,
    });

    return NextResponse.json(trip);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating trip status:", error);
    return NextResponse.json(
      { error: "Error updating trip status" },
      { status: 500 }
    );
  }
}