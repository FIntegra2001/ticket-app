// ============================================================================
// Fase 2: kilometraje, oficinas de origen y métodos de pago.
// Lógica PURA (cliente y servidor). La tarifa vigente se lee de BD en
// lib/mileage.server.ts.
//
// Reglas (CAMBIOS_TICKET_APP.md, 4.4):
//  · Origen siempre una oficina de la fundación; se vuelve a la oficina.
//  · km computables = km de ida × 2. Importe = km computables × tarifa.
//  · Siempre es adelanto personal (método de pago fijo) y no lleva ticket.
// ============================================================================

/** Tarifa por defecto si el administrador aún no ha configurado ninguna. */
export const DEFAULT_RATE_PER_KM = 0.26; // Orden HFP/792/2023

export const OFFICES = [
  { value: "Madrid", label: "Madrid — Paseo Castellana 86, Planta 2, 28046" },
  { value: "Sevilla", label: "Sevilla — Av. Álvaro Alonso Barba s/n, 41092" },
] as const;

/**
 * Categorías que se registran como kilometraje. El `value` se conserva
 * ("Gasolina", "GasolinaOficina") para no cambiar subcuentas ni Excel; solo
 * cambia lo que ve el usuario.
 */
export const KM_CATEGORIES = ["Gasolina", "GasolinaOficina"];

export function isKmCategory(category?: string | null): boolean {
  return !!category && KM_CATEGORIES.includes(category);
}

/** Valor guardado del adelanto personal (antes "Efectivo"; no se renombra en BD). */
export const PERSONAL_ADVANCE = "Efectivo";

export const PAYMENT_METHODS = [
  { value: "Tarjeta", label: "Santander tarj debito" },
  { value: PERSONAL_ADVANCE, label: "Adelanto personal (reembolso)" },
  { value: "Transferencia", label: "Santander transferencia" },
  { value: "Domiciliacion", label: "Santander domiciliacion" },
  { value: "Bankinter", label: "Bankinter" },
] as const;

export function paymentMethodLabel(value?: string | null): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value ?? "—";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMileage(kmOneWay: number, ratePerKm: number) {
  const kmTotal = round2(kmOneWay * 2);
  return { kmTotal, amount: round2(kmTotal * ratePerKm) };
}

export function formatKm(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

/** Línea de detalle para listados: "46 km ida y vuelta · Calle X · Proyecto Y". */
export function expenseDetail(e: {
  kmTotal?: number | string | null;
  destinationAddress?: string | null;
  justification?: string | null;
}): string {
  return [
    e.kmTotal != null ? `${formatKm(Number(e.kmTotal))} km ida y vuelta` : null,
    e.destinationAddress,
    e.justification,
  ]
    .filter(Boolean)
    .join(" · ");
}
