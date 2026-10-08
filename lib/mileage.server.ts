// Parte SERVIDOR del kilometraje (lee la tarifa de BD). No importar desde cliente.
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db";
import {
  computeMileage,
  DEFAULT_RATE_PER_KM,
  isKmCategory,
  OFFICES,
  PERSONAL_ADVANCE,
} from "@/lib/mileage";

/** Tarifa vigente en una fecha: la última con validFrom <= fecha. */
export async function getRateFor(date: Date): Promise<number> {
  const rate = await prisma.mileageRate.findFirst({
    where: { validFrom: { lte: date } },
    orderBy: { validFrom: "desc" },
  });
  return rate ? Number(rate.ratePerKm) : DEFAULT_RATE_PER_KM;
}

export class MileageError extends Error {}

type MileageInput = {
  category?: string;
  date?: string | Date;
  kmOneWay?: number;
  originOffice?: string;
  destinationAddress?: string;
};

/**
 * Si el gasto es de kilometraje, calcula en el servidor km, tarifa e importe
 * (el cliente no puede fijarlos) y fuerza el adelanto personal sin ticket.
 * Devuelve null si no es kilometraje.
 */
export async function buildMileageData(v: MileageInput, fallbackDate?: Date) {
  if (!isKmCategory(v.category) || v.kmOneWay === undefined) return null;
  if (!(v.kmOneWay > 0)) throw new MileageError("Indica los km de ida");
  if (!OFFICES.some((o) => o.value === v.originOffice)) {
    throw new MileageError("Elige la oficina de origen");
  }
  if (!v.destinationAddress?.trim()) {
    throw new MileageError("Indica la dirección de destino");
  }
  const date = v.date ? new Date(v.date) : fallbackDate ?? new Date();
  const ratePerKm = await getRateFor(date);
  const { kmTotal, amount } = computeMileage(v.kmOneWay, ratePerKm);
  return {
    originOffice: v.originOffice,
    destinationAddress: v.destinationAddress.trim(),
    kmOneWay: new Prisma.Decimal(v.kmOneWay),
    kmTotal: new Prisma.Decimal(kmTotal),
    ratePerKm: new Prisma.Decimal(ratePerKm),
    amount: new Prisma.Decimal(amount),
    amountNumber: amount,
    paymentMethod: PERSONAL_ADVANCE,
    receiptUrl: null as string | null,
  };
}
