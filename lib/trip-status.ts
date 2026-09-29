// ============================================================================
// Presentación de TripStatus en una sola pieza.
//
// El valor del enum (`PENDIENTE`) no explica nada al usuario: desde que existe
// el flujo de aprobación, PENDIENTE significa "solicitado, esperando que
// administración lo revise". Antes cada vista escribía su propio `switch` de
// variantes (TripCard, /admin, /admin/trips/[id]/expenses, los dashboards) y la
// etiqueta salía en crudo.
//
// Si se añade un estado, se añade aquí y TypeScript obliga a completar los mapas.
// ============================================================================

import type { TripStatus } from "@/types";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PENDIENTE: "Pendiente de aprobación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

/** Etiqueta corta, para tablas y selects donde no cabe la larga. */
export const TRIP_STATUS_SHORT_LABEL: Record<TripStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const TRIP_STATUS_VARIANT: Record<TripStatus, BadgeVariant> = {
  PENDIENTE: "outline",
  APROBADO: "default",
  RECHAZADO: "destructive",
};

export const TRIP_STATUS_OPTIONS: TripStatus[] = [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
];

/** Único estado que permite cargar gastos. Lo valida también el backend. */
export function acceptsExpenses(status: TripStatus): boolean {
  return status === "APROBADO";
}
