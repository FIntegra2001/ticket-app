// Fase 5: reglas de calidad de datos que necesitan la BD.
import prisma from "@/lib/db";

/**
 * El nº de liquidación (numberInvoice) no puede repetirse. Devuelve el mensaje
 * de error o null. Los duplicados antiguos se toleran: solo se comprueba
 * cuando se pone o se cambia el número.
 */
export async function invoiceNumberError(numberInvoice: string | null | undefined, excludeTripId?: string) {
  const n = numberInvoice?.trim();
  if (!n) return null;
  const other = await prisma.trip.findFirst({
    where: { numberInvoice: n, ...(excludeTripId && { id: { not: excludeTripId } }) },
    select: { city: true, startDate: true },
  });
  if (!other) return null;
  return `El nº de liquidación ${n} ya está asignado al viaje a ${other.city} del ${other.startDate.toLocaleDateString("es-ES")}.`;
}
