import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { updateTripRequestSchema } from "@/lib/validations";
import {
  prepareStages,
  replaceStages,
  StageError,
  stagesInclude,
} from "@/lib/trip-stages.server";
import { destroyTripDocument } from "@/lib/trip-documents.server";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ tripId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        assignedUsers: { some: { userId: session.user.id } }
      },
      include: {
        expenses: {
          orderBy: {
            date: "desc",
          },
        },
        stages: stagesInclude,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json(trip);
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json({ error: "Error fetching trip" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar ownership
    const existingTrip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        assignedUsers: { some: { userId: session.user.id } }
      },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 🆕 Esta ruta es la del USER: solo puede editar su SOLICITUD mientras esté
    // pendiente de aprobación. Un viaje aprobado o rechazado lo toca el admin
    // desde /api/admin/trips/[tripId].
    if (existingTrip.status !== "PENDIENTE") {
      return NextResponse.json(
        {
          error:
            "Este viaje ya ha sido revisado por un administrador y no se puede editar. Habla con administración si necesitas cambiarlo.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    // 🆕 Esquema restringido: sin `status`, `totalAmount`, `assignedUserIds` ni
    // `numberInvoice`. Antes se usaba `updateTripSchema` (el completo) sin
    // comprobar rol, así que un USER asignado podía auto-aprobarse el viaje y
    // reescribir el total.
    const validatedData = updateTripRequestSchema.parse(body);

    const updateData: Prisma.TripUpdateInput = {};

    if (validatedData.project !== undefined)
      updateData.project = validatedData.project;
    if (validatedData.notes !== undefined)
      updateData.notes = validatedData.notes;

    // Fase 1: nuevo itinerario → se recalculan ciudad, fechas y comunidad
    if (validatedData.stages !== undefined) {
      Object.assign(updateData, await prepareStages(validatedData.stages));
    }

    const trip = await prisma.$transaction(async (tx) => {
      if (validatedData.stages !== undefined) {
        await replaceStages(tx, tripId, validatedData.stages);
      }
      return tx.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        expenses: {
          orderBy: {
            date: "desc",
          },
        },
        stages: stagesInclude,
      },
      });
    });

    return NextResponse.json(trip);
  } catch (error) {
    if (error instanceof StageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error updating trip:", error);
    return NextResponse.json({ error: "Error updating trip" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar ownership
    const existingTrip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        assignedUsers: { some: { userId: session.user.id } }
      },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 🆕 Un USER solo puede retirar SU propia solicitud mientras siga pendiente.
    // Antes, cualquier usuario asignado podía borrar un viaje aprobado entero y,
    // por la cascada, todos sus gastos. Borrar viajes aprobados es cosa del
    // admin, desde /api/admin/trips/[tripId].
    if (existingTrip.status !== "PENDIENTE") {
      return NextResponse.json(
        {
          error:
            "Solo puedes eliminar una solicitud que siga pendiente de aprobación.",
        },
        { status: 403 },
      );
    }

    if (
      existingTrip.requestedById &&
      existingTrip.requestedById !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Solo puedes eliminar las solicitudes que has creado tú." },
        { status: 403 },
      );
    }

    // Una solicitud pendiente puede tener ya documentos si el admin los subió
    // antes de aprobar. La cascada borra las filas, pero no los ficheros.
    const documents = await prisma.tripDocument.findMany({
      where: { tripId },
      select: { publicId: true, mimeType: true },
    });
    await Promise.all(
      documents.map((d) => destroyTripDocument(d.publicId, d.mimeType)),
    );

    await prisma.trip.delete({
      where: { id: tripId },
    });

    return NextResponse.json({
      ok: true,
      message: "Trip deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json({ error: "Error deleting trip" }, { status: 500 });
  }
}
