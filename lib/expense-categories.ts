// ============================================================================
// FUENTE ÚNICA DE VERDAD de las categorías de gasto.
//
// Todo lo que dependa de categorías (select del formulario, prompt de OCR,
// mapas contables de los Excel) se deriva de EXPENSE_CATEGORIES. NO redefinas
// estos mapas en ningún otro archivo.
//
// Grafía de `concepto`/`subconcepto`: EXACTA tal y como la entregó financiero
// (mayúsculas/minúsculas incluidas). No "normalizar".
//
// Campo `ocr`: true si el OCR puede sugerir la categoría automáticamente.
// Las categorías "de oficina" (ocr:false) son de selección MANUAL en el
// formulario: un ticket no revela si el gasto es de viaje o de oficina, así que
// el modelo no debe adivinarlo.
// ============================================================================

export const EXPENSE_CATEGORIES = [
  {
    value: "Taxi",
    label: "Taxi",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Taxi viajes",
    subcuenta: "62900000006",
    ocr: true,
  },
  {
    value: "Comida",
    label: "Comida",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Comidas viajes",
    subcuenta: "62900000024",
    ocr: true,
  },
  {
    value: "Hotel",
    label: "Hotel",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Hotel viajes",
    subcuenta: "62900000039",
    ocr: true,
  },
  {
    value: "Metrobus/Parking",
    label: "Metrobus/Parking",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Parking viajes metrobus",
    subcuenta: "62900000045",
    ocr: true,
  },
  {
    value: "Gasolina",
    label: "Gasolina",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Gasolina viajes",
    subcuenta: "62900000031",
    ocr: true,
  },
  {
    value: "Ave",
    label: "Ave",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Ave",
    subcuenta: "62900000025",
    ocr: true,
  },
  {
    value: "Avion",
    label: "Avion",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Avion",
    subcuenta: "62900000038",
    ocr: true,
  },
  {
    value: "ComidasOficina",
    label: "Escuela Formación",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Comidas oficina",
    subcuenta: "62900000022",
    ocr: true,
  },
  {
    value: "TaxiOficina",
    label: "Taxi oficina/coche",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Taxi oficina/coche",
    subcuenta: "62900000019",
    ocr: false,
  },
  {
    value: "ParkingOficina",
    label: "Parking oficina-metrobus",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "parking oficina-metrobus",
    subcuenta: "62900000008",
    ocr: false,
  },
  {
    value: "GasolinaOficina",
    label: "Gasolina oficina",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "gasolina oficina",
    subcuenta: "62900000029",
    ocr: false,
  },
] as const;

// Union type derivada de los `value` → "Taxi" | "Comida" | ... | "GasolinaOficina"
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

// Mapa contable: value → { concepto, subconcepto }
export const SUBCUENTAS: Record<
  string,
  { concepto: string; subconcepto: string }
> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [
    c.value,
    { concepto: c.concepto, subconcepto: c.subconcepto },
  ]),
);

// Mapa contable: value → subcuenta (código contable)
export const SUBCUENTAS_CONTABILIDAD: Record<string, string> =
  Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.subcuenta]));

// Solo los value que el OCR puede sugerir (ocr:true)
export const OCR_CATEGORIES: ExpenseCategory[] = EXPENSE_CATEGORIES.filter(
  (c) => c.ocr,
).map((c) => c.value);

// Type guard: ¿es `value` una categoría válida conocida?
export function isValidCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    EXPENSE_CATEGORIES.some((c) => c.value === value)
  );
}
