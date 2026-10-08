// Parte SERVIDOR del itinerario (toca la base de datos). No importar desde componentes cliente.
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db";
import { checkStages, pickStageForDate, summarizeStages, toDay, type StageInput } from "@/lib/trip-stages";

/** Error de negocio con status HTTP: las rutas lo convierten en respuesta JSON. */
export class StageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Valida el itinerario contra el catálogo y devuelve el resumen para Trip. */
export async function prepareStages(stages: StageInput[]) {
  const cities = await prisma.city.findMany({
    where: { id: { in: stages.map((s) => s.cityId) } },
  });
  const { errors } = checkStages(stages, cities);
  if (errors.length > 0) throw new StageError(errors.map((e) => e.message).join(". "));
  return summarizeStages(stages, cities);
}

function stageData(s: StageInput, position: number) {
  return {
    position,
    cityId: s.cityId,
    cityOther: s.cityOther?.trim() || null,
    arrivalDate: toDay(s.arrivalDate),
    departureDate: toDay(s.departureDate),
  };
}

/** Para `prisma.trip.create({ data: { stages: createStagesInput(...) } })`. */
export function createStagesInput(stages: StageInput[]) {
  return { create: stages.map((s, i) => stageData(s, i + 1)) };
}

/**
 * Sustituye el itinerario de un viaje existente dentro de una transacción.
 * Los tramos se emparejan por posición (Destino 1 ↔ tramo 1…), así los gastos
 * siguen en su tramo aunque cambien ciudad o fechas. Quitar un destino que
 * tiene gastos está bloqueado: hay que reasignarlos antes.
 */
export async function replaceStages(
  tx: Prisma.TransactionClient,
  tripId: string,
  stages: StageInput[],
) {
  const existing = await tx.tripStage.findMany({
    where: { tripId },
    orderBy: { position: "asc" },
    include: { _count: { select: { expenses: true } } },
  });

  const removed = existing.slice(stages.length);
  const blocked = removed.filter((s) => s._count.expenses > 0);
  if (blocked.length > 0) {
    throw new StageError(
      `No se puede quitar el destino ${blocked.map((s) => s.position).join(", ")} porque tiene gastos. Cambia antes esos gastos de destino.`,
      409,
    );
  }
  if (removed.length > 0) {
    await tx.tripStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
  }

  for (let i = 0; i < stages.length; i++) {
    const data = stageData(stages[i], i + 1);
    if (existing[i]) {
      await tx.tripStage.update({ where: { id: existing[i].id }, data });
    } else {
      await tx.tripStage.create({ data: { ...data, tripId } });
    }
  }
}

/**
 * Tramo de un gasto de viaje: el elegido (si pertenece al viaje) o el que
 * corresponde por fecha. Devuelve null si el viaje aún no tiene tramos.
 */
export async function resolveExpenseStage(
  tripId: string,
  date: Date,
  stageId?: string | null,
): Promise<string | null> {
  const stages = await prisma.tripStage.findMany({ where: { tripId } });
  if (stages.length === 0) return null;
  if (stageId) {
    if (!stages.some((s) => s.id === stageId)) {
      throw new StageError("El destino elegido no pertenece a este viaje");
    }
    return stageId;
  }
  return pickStageForDate(stages, date)?.id ?? null;
}

export const stagesInclude = {
  orderBy: { position: "asc" as const },
  include: { city: true },
};
