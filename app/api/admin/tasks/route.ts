import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isKmCategory } from "@/lib/mileage";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// ============================================================================
// Fase 5: bandeja de tareas del ADMIN. Sin importes agregados: la verdad
// económica (tickets + billetes + hotel) está en Facturas Integra.
// ============================================================================

const DAY = 24 * 60 * 60 * 1000;
const todayUTC = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const tripSelect = {
  id: true,
  city: true,
  startDate: true,
  endDate: true,
  numberInvoice: true,
  status: true,
  createdAt: true,
  assignedUsers: { select: { user: { select: { name: true, email: true } } } },
} as const;

type TripRow = {
  id: string;
  city: string;
  startDate: Date;
  endDate: Date;
  numberInvoice: string | null;
  assignedUsers: { user: { name: string | null; email: string } }[];
};
const row = (t: TripRow, detail?: string) => ({
  id: t.id,
  city: t.city,
  startDate: t.startDate,
  endDate: t.endDate,
  numberInvoice: t.numberInvoice,
  people: t.assignedUsers.map((a) => a.user.name ?? a.user.email).join(", "),
  detail,
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayUTC();
  const in7 = new Date(today.getTime() + 7 * DAY);
  const in30 = new Date(today.getTime() + 30 * DAY);
  const ago90 = new Date(today.getTime() - 90 * DAY);
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));

  const [pending, noInvoice, upcoming, activeTrips, finished, openOffice, cityCounts] = await Promise.all([
    // 1. Solicitudes pendientes de aprobar
    prisma.trip.findMany({ where: { status: "PENDIENTE" }, select: tripSelect, orderBy: { startDate: "asc" } }),
    // 2. Aprobados sin nº de liquidación
    prisma.trip.findMany({
      where: { status: "APROBADO", OR: [{ numberInvoice: null }, { numberInvoice: "" }] },
      select: tripSelect,
      orderBy: { startDate: "asc" },
    }),
    // 3. Próximos viajes (30 días)
    prisma.trip.findMany({
      where: { status: "APROBADO", startDate: { gte: today, lte: in30 } },
      select: tripSelect,
      orderBy: { startDate: "asc" },
    }),
    // 4. Aprobados en curso o futuros, para ver billete/reserva
    prisma.trip.findMany({
      where: { status: "APROBADO", endDate: { gte: today } },
      select: { ...tripSelect, documents: { select: { type: true } } },
      orderBy: { startDate: "asc" },
    }),
    // 5. Terminados en los últimos 90 días, para revisar sus tickets
    prisma.trip.findMany({
      where: { status: "APROBADO", endDate: { lt: today, gte: ago90 } },
      select: { ...tripSelect, expenses: { select: { category: true, receiptUrl: true } } },
      orderBy: { endDate: "desc" },
    }),
    // 6. Partes de oficina del mes anterior aún abiertos
    prisma.officeExpense.findMany({
      where: { status: "ABIERTO", year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 },
      select: { id: true, year: true, month: true, user: { select: { name: true, email: true } }, _count: { select: { expenses: true } } },
    }),
    // Dato operativo: ciudades más visitadas (sin importes)
    prisma.trip.groupBy({ by: ["city"], where: { status: "APROBADO" }, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 5 }),
  ]);

  const missingDocs = activeTrips
    .map((t) => {
      const has = (type: string) => t.documents.some((d) => d.type === type);
      const missing = [!has("BILLETE") && "billete", !has("RESERVA") && "reserva"].filter(Boolean);
      return missing.length ? row(t, `Falta ${missing.join(" y ")}`) : null;
    })
    .filter(Boolean);

  const ticketIssues = finished
    .map((t) => {
      if (t.expenses.length === 0) return row(t, "Sin tickets subidos");
      const noCat = t.expenses.filter((e) => !e.category).length;
      const noPhoto = t.expenses.filter((e) => !e.receiptUrl && !isKmCategory(e.category)).length;
      const parts = [noCat && `${noCat} sin categoría`, noPhoto && `${noPhoto} sin foto`].filter(Boolean);
      return parts.length ? row(t, parts.join(" · ")) : null;
    })
    .filter(Boolean);

  return NextResponse.json({
    pending: pending.map((t) => row(t)),
    noInvoice: noInvoice.map((t) => row(t)),
    upcoming: upcoming.map((t) => row(t, t.startDate <= in7 ? "Esta semana" : undefined)),
    missingDocs,
    ticketIssues,
    openOffice: openOffice.map((o) => ({
      id: o.id,
      person: o.user.name ?? o.user.email,
      period: `${String(o.month).padStart(2, "0")}/${o.year}`,
      expenses: o._count.expenses,
    })),
    topCities: cityCounts.map((c) => ({ city: c.city, trips: c._count._all })),
  });
}
