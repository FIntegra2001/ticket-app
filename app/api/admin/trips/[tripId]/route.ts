import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { updateTripSchema } from "@/lib/validations";
import {
  prepareStages,
  replaceStages,
  StageError,
  stagesInclude,
} from "@/lib/trip-stages.server";
import { destroyTripDocument } from "@/lib/trip-documents.server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ tripId: string }>;
};

// ✅ Include reutilizable — TripAssignment → user → campos
/**
 * 🆕 Antes de borrar un viaje, elimina sus documentos de Cloudinary.
 * La cascada de Prisma borra las filas de `trip_documents`, pero los ficheros
 * quedarían huérfanos en Cloudinary para siempre: no se migran a SharePoint ni
 * los recoge la limpieza de 3 meses. Los tickets de gasto NO se tocan aquí: esos
 * sí van a SharePoint y los gestiona la migración.
 */
async function deleteTripDocumentFiles(tripId: string) {
  const documents = await prisma.tripDocument.findMany({
    where: { tripId },
    select: { publicId: true, mimeType: true },
  });

  await Promise.all(
    documents.map((d) => destroyTripDocument(d.publicId, d.mimeType)),
  );
}

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
  // 🆕 Origen del viaje (solicitado por un USER o creado por admin), quién lo
  // aprobó y el estado documental que pintan los badges de la card.
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  documents: { select: { id: true, type: true } },
  stages: stagesInclude,
} as const;

export async function GET(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json(trip);
  } catch (error) {
    console.error("Error fetching admin trip:", error);
    return NextResponse.json({ error: "Error fetching trip" }, { status: 500 });
  }
}

// ✅ NUEVO: PUT — actualizar trip (solo admin)
export async function PUT(request: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateTripSchema.parse(body);

    // Construir objeto de actualización
    const updateData: Prisma.TripUpdateInput = {};

    if (validatedData.project !== undefined)
      updateData.project = validatedData.project;
    if (validatedData.notes !== undefined)
      updateData.notes = validatedData.notes;
    if (validatedData.status !== undefined)
      updateData.status = validatedData.status;
    if (validatedData.numberInvoice !== undefined)
      updateData.numberInvoice = validatedData.numberInvoice;
    // Fase 1: nuevo itinerario → se recalculan ciudad, fechas y comunidad
    if (validatedData.stages !== undefined) {
      Object.assign(updateData, await prepareStages(validatedData.stages));
    }

    const trip = await prisma.$transaction(async (tx) => {
      if (validatedData.stages !== undefined) {
        await replaceStages(tx, tripId, validatedData.stages);
      }
      // ✅ Actualizar asignaciones si vienen
      if (validatedData.assignedUserIds !== undefined) {
        await tx.tripAssignment.deleteMany({ where: { tripId } });
        await tx.tripAssignment.createMany({
          data: validatedData.assignedUserIds.map((userId) => ({ tripId, userId })),
        });
      }
      return tx.trip.update({
        where: { id: tripId },
        data: updateData,
        include: tripInclude,
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

// ✅ NUEVO: DELETE — eliminar trip (solo admin)
export async function DELETE(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Los ficheros de Cloudinary primero: la cascada de Prisma solo borra filas
    await deleteTripDocumentFiles(tripId);

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
