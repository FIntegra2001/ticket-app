// Fase 3: pestañas del listado de viajes del ADMIN.
//  · Solicitudes: PENDIENTE (falta aprobar)
//  · Próximos:    APROBADO cuya vuelta es hoy o después
//  · Realizados:  APROBADO con la vuelta ya pasada, y RECHAZADOS
import type { Prisma } from "@/app/generated/prisma/client";

export const TRIP_TABS = [
  { value: "solicitudes", label: "Solicitudes" },
  { value: "proximos", label: "Próximos" },
  { value: "realizados", label: "Realizados" },
] as const;

export type TripTab = (typeof TRIP_TABS)[number]["value"];

export function isTripTab(v: string | null): v is TripTab {
  return TRIP_TABS.some((t) => t.value === v);
}

/** Medianoche UTC de hoy: endDate se guarda como día (00:00 UTC). */
function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function tripTabWhere(tab: TripTab): Prisma.TripWhereInput {
  const t = today();
  switch (tab) {
    case "solicitudes":
      return { status: "PENDIENTE" };
    case "proximos":
      return { status: "APROBADO", endDate: { gte: t } };
    case "realizados":
      return {
        OR: [{ status: "APROBADO", endDate: { lt: t } }, { status: "RECHAZADO" }],
      };
  }
}

/** Próximos: el más cercano primero. El resto: lo más reciente primero. */
export function tripTabOrder(tab: TripTab): Prisma.TripOrderByWithRelationInput {
  return tab === "proximos" ? { startDate: "asc" } : { startDate: "desc" };
}

/** Filtro por mes de inicio del viaje (?month=YYYY-MM). */
export function monthWhere(month: string | null): Prisma.TripWhereInput {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return {};
  const [y, m] = month.split("-").map(Number);
  return { startDate: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } };
}
