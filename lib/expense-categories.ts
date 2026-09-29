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
// Campo `scope`: "trip" = gasto de un viaje · "office" = gasto de oficina.
// Cada contexto ve SOLO sus categorías. Es lo que impide imputar un taxi de
// oficina a la cuenta de taxi de viaje (62900000019 vs 62900000006), que son
// cuentas contables distintas y el error sería silencioso.
//
// Campo `ocr`: true si el OCR puede sugerir la categoría. Dentro de un parte de
// oficina el contexto ya resuelve la ambigüedad (un taxi en un parte de oficina
// ES taxi de oficina), así que las de oficina también son sugeribles — pero el
// prompt y la whitelist se construyen siempre a partir del `scope` recibido.
// ============================================================================

export type CategoryScope = "trip" | "office";

export const EXPENSE_CATEGORIES = [
  // ---------------------------------------------------------------- VIAJE ---
  {
    value: "Taxi",
    label: "Taxi",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Taxi viajes",
    subcuenta: "62900000006",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Comida",
    label: "Comida",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Comidas viajes",
    subcuenta: "62900000024",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Hotel",
    label: "Hotel",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Hotel viajes",
    subcuenta: "62900000039",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Metrobus/Parking",
    label: "Metrobus/Parking",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Parking viajes metrobus",
    subcuenta: "62900000045",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Gasolina",
    label: "Gasolina",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Gasolina viajes",
    subcuenta: "62900000031",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Ave",
    label: "Ave",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Ave",
    subcuenta: "62900000025",
    scope: "trip",
    ocr: true,
  },
  {
    value: "Avion",
    label: "Avion",
    concepto: "GASTOS DE VIAJE",
    subconcepto: "Avion",
    subcuenta: "62900000038",
    scope: "trip",
    ocr: true,
  },

  // -------------------------------------------------------------- OFICINA ---
  // ⚠️ Estas 8 son las que financiero entregó para gastos de oficina. Las 4 que
  // ya existían conservan su `subconcepto` (validado con financiero) y solo
  // cambian de `label`: dentro de un parte de oficina no hace falta el sufijo.
  // ⚠️ `ComidasOficina` ya NO aparece en el select de viajes (donde figuraba con
  // el label "Escuela Formación"). Los gastos históricos que la tengan siguen
  // exportando bien: SUBCUENTAS conserva la entrada.
  {
    value: "Limpieza",
    label: "Limpieza",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Limpieza",
    subcuenta: "62900000012",
    scope: "office",
    ocr: true,
  },
  {
    value: "Mensajeria",
    label: "mensajeria",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "mensajeria",
    subcuenta: "62400000000",
    scope: "office",
    ocr: true,
  },
  {
    value: "TaxiOficina",
    label: "Taxi",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Taxi oficina/coche",
    subcuenta: "62900000019",
    scope: "office",
    ocr: true,
  },
  {
    value: "ParkingOficina",
    label: "parking o metrobus",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "parking oficina-metrobus",
    subcuenta: "62900000008",
    scope: "office",
    ocr: true,
  },
  {
    value: "GasolinaOficina",
    label: "gasolina",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "gasolina oficina",
    subcuenta: "62900000029",
    scope: "office",
    ocr: true,
  },
  {
    value: "Material",
    label: "Material",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Material",
    subcuenta: "62900000001",
    scope: "office",
    ocr: true,
  },
  {
    value: "ComidasOficina",
    label: "comidas",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Comidas oficina",
    subcuenta: "62900000022",
    scope: "office",
    ocr: true,
  },
  {
    value: "Regalos",
    label: "Regalos",
    concepto: "FUNCIONAMIENTO OFICINA",
    subconcepto: "Regalos",
    subcuenta: "62900000036",
    scope: "office",
    ocr: true,
  },
] as const;

// Union type derivada de los `value` → "Taxi" | "Comida" | ... | "Regalos"
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

// Mapa contable: value → { concepto, subconcepto }
// Incluye TODAS las categorías (los dos scopes): los Excel tienen que poder
// resolver cualquier categoría histórica que aparezca en un gasto.
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

// Categorías por contexto. Es lo que alimenta cada select.
export const TRIP_CATEGORIES = EXPENSE_CATEGORIES.filter(
  (c) => c.scope === "trip",
);
export const OFFICE_CATEGORIES = EXPENSE_CATEGORIES.filter(
  (c) => c.scope === "office",
);

export function getCategoriesByScope(scope: CategoryScope) {
  return scope === "office" ? OFFICE_CATEGORIES : TRIP_CATEGORIES;
}

/** Los `value` que el OCR puede sugerir dentro de un contexto dado. */
export function getOcrCategories(scope: CategoryScope): ExpenseCategory[] {
  return getCategoriesByScope(scope)
    .filter((c) => c.ocr)
    .map((c) => c.value);
}

// Type guard: ¿es `value` una categoría válida conocida?
export function isValidCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    EXPENSE_CATEGORIES.some((c) => c.value === value)
  );
}

/**
 * ¿Es `value` una categoría válida PARA ESTE CONTEXTO? Es la comprobación que
 * usan las rutas de gastos: sin el scope, un gasto de oficina podría entrar con
 * la categoría "Taxi" (cuenta de viaje) y nadie se enteraría hasta el cierre
 * contable.
 */
export function isValidCategoryForScope(
  value: unknown,
  scope: CategoryScope,
): value is ExpenseCategory {
  return (
    isValidCategory(value) &&
    getCategoriesByScope(scope).some((c) => c.value === value)
  );
}
