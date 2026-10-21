import { isTripTab, TRIP_TABS, tripTabOrder, tripTabWhere } from "@/lib/trip-tabs";
import { stagesInclude } from "@/lib/trip-stages.server";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Obtener parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "15");
    const skip = (page - 1) * limit;

    // 🆕 Filtro opcional por estado: lo usa el panel para listar las solicitudes
    // pendientes de aprobación sin traerse todos los viajes.
    const statusParam = searchParams.get("status");
    // Fase 3: pestaña del listado (solicitudes | proximos | realizados)
    const tabParam = searchParams.get("tab");
    const tab = isTripTab(tabParam) ? tabParam : null;
    const where: Prisma.TripWhereInput = tab
      ? tripTabWhere(tab)
      : statusParam === "PENDIENTE" ||
          statusParam === "APROBADO" ||
          statusParam === "RECHAZADO"
        ? { status: statusParam }
        : {};

    // ✅ Consulta con paginación
    const [trips, totalCount] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          assignedUsers: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          expenses: true,
          // 🆕 Quién solicitó el viaje (para el bloque de aprobaciones) y el
          // estado documental, que la card pinta como badges.
          requestedBy: { select: { id: true, name: true, email: true } },
          documents: { select: { id: true, type: true, createdAt: true } },
          stages: stagesInclude,
        },
        orderBy: tab ? tripTabOrder(tab) : { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.trip.count({ where }),
    ]);

    // Contadores de las tres pestañas (para los números junto a cada una)
    const counts = Object.fromEntries(
      await Promise.all(
        TRIP_TABS.map(async (t) => [t.value, await prisma.trip.count({ where: tripTabWhere(t.value) })]),
      ),
    );

    return NextResponse.json({
      trips,
      counts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + trips.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching admin trips:", error);
    return NextResponse.json(
      { error: "Error fetching trips" },
      { status: 500 },
    );
  }
}
