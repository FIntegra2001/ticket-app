// ============================================================================
// Fase 1: itinerario de un viaje en tramos (destinos encadenados).
//
// Lógica PURA, compartida por el formulario (cliente) y las rutas (servidor).
// Lo que necesita base de datos (ciudades, guardar tramos) está en
// lib/trip-stages.server.ts.
//
// Reglas de negocio (CAMBIOS_TICKET_APP.md, cambio 1):
//  · Un viaje = una liquidación, con 1..N tramos ordenados.
//  · Siempre se sale y se vuelve a la oficina: no hay tramo de "vuelta".
//  · Los tramos no se solapan: la llegada a un destino es >= la salida del
//    anterior. Un hueco entre tramos se permite pero se avisa.
//  · Todas las ciudades de un viaje son de la misma comunidad autónoma
//    (decisión de Gabriel: nunca se viaja entre comunidades).
// ============================================================================

import { z } from "zod";

export const MAX_STAGES = 10;

export type City = {
  id: string;
  name: string;
  region: string | null;
  isOther: boolean;
  active: boolean;
  sortOrder: number;
};

export type TripStage = {
  id: string;
  tripId: string;
  position: number;
  cityId: string;
  city?: City;
  cityOther?: string | null;
  arrivalDate: Date | string;
  departureDate: Date | string;
};

/** Lo que manda el formulario por cada destino. Fechas "YYYY-MM-DD" o ISO. */
export const stageInputSchema = z.object({
  cityId: z.string().min(1, "Elige una ciudad"),
  cityOther: z.string().trim().optional(),
  arrivalDate: z.string().min(1, "Falta la fecha de llegada"),
  departureDate: z.string().min(1, "Falta la fecha de salida"),
});
export type StageInput = z.infer<typeof stageInputSchema>;

export const stagesSchema = z
  .array(stageInputSchema)
  .min(1, "El viaje necesita al menos un destino")
  .max(MAX_STAGES, `Máximo ${MAX_STAGES} destinos`);

const DAY = 24 * 60 * 60 * 1000;

/** Normaliza a medianoche UTC del día indicado, para comparar solo fechas. */
export function toDay(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function nightsBetween(arrival: Date | string, departure: Date | string): number {
  return Math.max(0, Math.round((toDay(departure).getTime() - toDay(arrival).getTime()) / DAY));
}

/** Nombre visible de un tramo ("Otro (especificar)" muestra el texto libre). */
export function stageCityName(
  stage: { cityOther?: string | null; city?: Pick<City, "name" | "isOther"> | null },
): string {
  if (stage.city?.isOther) return stage.cityOther?.trim() || "Otro";
  return stage.city?.name ?? stage.cityOther ?? "—";
}

export type StageIssue = { index: number | null; message: string };

/**
 * Valida el itinerario. Devuelve errores (bloquean) y avisos (no bloquean).
 * `cities` es el catálogo, para comprobar "Otro" y la comunidad autónoma.
 */
export function checkStages(
  stages: StageInput[],
  cities: Pick<City, "id" | "region" | "isOther" | "name">[],
): { errors: StageIssue[]; warnings: StageIssue[] } {
  const errors: StageIssue[] = [];
  const warnings: StageIssue[] = [];
  const byId = new Map(cities.map((c) => [c.id, c]));

  stages.forEach((s, i) => {
    const city = byId.get(s.cityId);
    if (!city) {
      errors.push({ index: i, message: `Destino ${i + 1}: elige una ciudad` });
    } else if (city.isOther && !s.cityOther?.trim()) {
      errors.push({ index: i, message: `Destino ${i + 1}: escribe el nombre de la ciudad` });
    }
    if (s.arrivalDate && s.departureDate && toDay(s.departureDate) < toDay(s.arrivalDate)) {
      errors.push({ index: i, message: `Destino ${i + 1}: la salida no puede ser anterior a la llegada` });
    }
    if (i > 0) {
      const prev = stages[i - 1];
      if (prev.departureDate && s.arrivalDate) {
        const gap = toDay(s.arrivalDate).getTime() - toDay(prev.departureDate).getTime();
        if (gap < 0) {
          errors.push({
            index: i,
            message: `Destino ${i + 1}: la llegada no puede ser anterior a la salida del destino ${i}`,
          });
        } else if (gap > 0) {
          warnings.push({
            index: i,
            message: `Hay ${Math.round(gap / DAY)} día(s) sin destino entre el destino ${i} y el ${i + 1}`,
          });
        }
      }
    }
  });

  // Misma comunidad autónoma para todas las ciudades del catálogo ("Otro" no
  // tiene comunidad y no se puede comprobar).
  const regions = new Set(
    stages
      .map((s) => byId.get(s.cityId))
      .filter((c): c is NonNullable<typeof c> => !!c && !c.isOther && !!c.region)
      .map((c) => c.region),
  );
  if (regions.size > 1) {
    errors.push({
      index: null,
      message: `Todos los destinos deben ser de la misma comunidad autónoma (has elegido: ${[...regions].join(", ")})`,
    });
  }

  return { errors, warnings };
}

/**
 * Resumen que se guarda en el propio viaje (city, startDate, endDate, region)
 * para que listados, dashboards y Excel existentes sigan funcionando igual.
 */
export function summarizeStages(
  stages: StageInput[],
  cities: Pick<City, "id" | "name" | "region" | "isOther">[],
): { city: string; startDate: Date; endDate: Date; region: string | null } {
  const byId = new Map(cities.map((c) => [c.id, c]));
  const names = stages.map((s) => stageCityName({ cityOther: s.cityOther, city: byId.get(s.cityId) }));
  const region =
    stages.map((s) => byId.get(s.cityId)).find((c) => c && !c.isOther && c.region)?.region ?? null;
  return {
    city: names.join(" + "),
    startDate: toDay(stages[0].arrivalDate),
    endDate: toDay(stages[stages.length - 1].departureDate),
    region,
  };
}

/**
 * Tramo que la app propone para un gasto según su fecha. En el día de cambio
 * de destino (salida de uno = llegada del siguiente) propone el NUEVO destino;
 * el usuario puede cambiarlo. Fuera del itinerario: el primero o el último.
 */
export function pickStageForDate<T extends { arrivalDate: Date | string; departureDate: Date | string; position: number }>(
  stages: T[],
  date: Date | string,
): T | null {
  if (stages.length === 0) return null;
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const d = toDay(date).getTime();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const s = sorted[i];
    if (toDay(s.arrivalDate).getTime() <= d && d <= toDay(s.departureDate).getTime()) return s;
  }
  return d < toDay(sorted[0].arrivalDate).getTime() ? sorted[0] : sorted[sorted.length - 1];
}
