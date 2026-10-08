import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createTripSchema, requestTripSchema } from "@/lib/validations";
import {
  createStagesInput,
  prepareStages,
  StageError,
  stagesInclude,
} from "@/lib/trip-stages.server";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "9");
    const skip = (page - 1) * limit;

    // ✅ USER solo ve viajes asignados a él
    const whereClause = {
      assignedUsers: {
        some: {
          userId: session.user.id,
        },
      },
    };

    const [trips, totalCount] = await Promise.all([
      prisma.trip.findMany({
        where: whereClause,
        include: {
          assignedUsers: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          expenses: true,
          stages: stagesInclude,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.trip.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      trips,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + trips.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json({ error: "Error fetching trips" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const body = await request.json();

    // 🆕 Dos caminos según el rol:
    //  - ADMIN crea el viaje ya aprobado (no hay a quién pedírselo) y elige
    //    asignados y nº de factura.
    //  - USER crea una SOLICITUD en PENDIENTE, autoasignada. No puede elegir
    //    asignados ni nº de factura: su esquema no los declara.
    // Fase 1: el itinerario se valida contra el catálogo de ciudades y de él
    // salen ciudad, fechas y comunidad del viaje.
    const data: Prisma.TripCreateInput = isAdmin
      ? await (async () => {
          const v = createTripSchema.parse(body);
          return {
            createdByAdmin: { connect: { id: session.user.id } },
            ...(await prepareStages(v.stages)),
            stages: createStagesInput(v.stages),
            project: v.project,
            notes: v.notes,
            numberInvoice: v.numberInvoice,
            status: "APROBADO",
            approvedAt: new Date(),
            approvedBy: { connect: { id: session.user.id } },
            assignedUsers: {
              create: v.assignedUserIds.map((userId) => ({ userId })),
            },
          };
        })()
      : await (async () => {
          const v = requestTripSchema.parse(body);
          return {
            requestedBy: { connect: { id: session.user.id } },
            ...(await prepareStages(v.stages)),
            stages: createStagesInput(v.stages),
            project: v.project,
            notes: v.notes,
            status: "PENDIENTE",
            assignedUsers: { create: [{ userId: session.user.id }] },
          };
        })();

    const trip = await prisma.trip.create({
      data,
      include: {
        assignedUsers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        expenses: true,
        stages: stagesInclude,
      },
    });

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    if (error instanceof StageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating trip:", error);
    return NextResponse.json({ error: "Error creating trip" }, { status: 500 });
  }
}