// Fase 5: reglas de calidad de datos (las comprueba el servidor).
import { toDay } from "@/lib/trip-stages";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Fecha de un ticket de viaje: entre 7 días antes del inicio del viaje y hoy.
 * Evita fechas imposibles (2016, 2028) por lecturas erróneas del ticket.
 */
export function tripExpenseDateError(date: Date | string, tripStart: Date | string): string | null {
  const d = toDay(date).getTime();
  const min = toDay(tripStart).getTime() - 7 * DAY;
  const max = toDay(new Date()).getTime() + DAY; // margen por zona horaria
  if (Number.isNaN(d)) return "Fecha del gasto no válida";
  if (d < min) return "La fecha del ticket es más de 7 días anterior al inicio del viaje. Revisa la fecha.";
  if (d > max) return "La fecha del ticket no puede ser posterior a hoy. Revisa la fecha.";
  return null;
}
