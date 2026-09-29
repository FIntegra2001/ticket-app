import { z } from "zod";

// Las fechas llegan como ISO string o Date. Refinamiento común: el fin no puede
// ser anterior al inicio. Se aplica solo cuando ambas están presentes.
const endAfterStart = <
  T extends { startDate?: string | Date; endDate?: string | Date },
>(
  data: T,
) =>
  data.startDate === undefined ||
  data.endDate === undefined ||
  new Date(data.endDate) >= new Date(data.startDate);

// Se construye en cada llamada: zod exige `path` mutable, así que no vale un
// objeto compartido con `as const`.
const endAfterStartError = () => ({
  message: "La fecha de fin no puede ser anterior a la de inicio",
  path: ["endDate"] as PropertyKey[],
});

// ============= TRIP SCHEMAS =============
// Creación por ADMIN: exige asignados y admite el nº de factura interno.
export const createTripSchema = z
  .object({
    city: z.string().min(1, "La ciudad es requerida"),
    startDate: z.string().datetime().or(z.date()),
    endDate: z.string().datetime().or(z.date()),
    project: z.string().optional(),
    notes: z.string().optional(),
    assignedUserIds: z
      .array(z.string())
      .min(1, "Debes asignar al menos un usuario"), // ✅ NUEVO
    numberInvoice: z.string().optional(),
  })
  .refine(endAfterStart, endAfterStartError());

// 🆕 Solicitud de viaje por un USER. No lleva `assignedUserIds` (se autoasigna)
// ni `numberInvoice` (lo pone el admin al aprobar). Si el cliente los manda, se
// ignoran: zod sin `.strict()` descarta lo que no está declarado.
export const requestTripSchema = z
  .object({
    city: z.string().min(1, "La ciudad es requerida"),
    startDate: z.string().datetime().or(z.date()),
    endDate: z.string().datetime().or(z.date()),
    project: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(endAfterStart, endAfterStartError());

// 🆕 Edición de su propia solicitud por parte del USER. Deliberadamente NO
// incluye `status`, `totalAmount`, `assignedUserIds` ni `numberInvoice`: con el
// esquema completo, un USER podía auto-aprobarse el viaje.
export const updateTripRequestSchema = z
  .object({
    city: z.string().min(1).optional(),
    startDate: z.string().datetime().or(z.date()).optional(),
    endDate: z.string().datetime().or(z.date()).optional(),
    project: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(endAfterStart, endAfterStartError());

// Edición completa: SOLO para las rutas de admin.
export const updateTripSchema = z
  .object({
    city: z.string().min(1).optional(),
    startDate: z.string().datetime().or(z.date()).optional(),
    endDate: z.string().datetime().or(z.date()).optional(),
    project: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]).optional(), // ✅ Corregido
    totalAmount: z.number().optional(),
    assignedUserIds: z.array(z.string()).optional(),
    numberInvoice: z.string().optional(),
  })
  .refine(endAfterStart, endAfterStartError());

// Schema específico para actualizar status
export const updateStatusSchema = z.object({
  status: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]), // ✅ Corregido
});

// ============= OFFICE EXPENSE SCHEMAS =============
// 🆕 Parte de gastos de oficina: la cabecera mensual. No pasa por aprobación.
export const createOfficeExpenseSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOfficeExpenseSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["ABIERTO", "CERRADO"]).optional(),
});

// ============= EXPENSE SCHEMAS =============
export const createExpenseSchema = z.object({
  date: z.string().datetime().or(z.date()),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  category: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  invoiceNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  date: z.string().datetime().or(z.date()).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  invoiceNumber: z.string().optional(), // ✅ NUEVO
  paymentMethod: z.string().optional(), // ✅ NUEVO
});
