import { z } from "zod";
import { stagesSchema } from "@/lib/trip-stages";

// ============= TRIP SCHEMAS =============
// Fase 1: el destino y las fechas se envían como itinerario (`stages`). La
// ciudad y las fechas del viaje se calculan en el servidor a partir de él.

// Creación por ADMIN: exige asignados y admite el nº de factura interno.
export const createTripSchema = z.object({
  stages: stagesSchema,
  project: z.string().optional(),
  notes: z.string().optional(),
  assignedUserIds: z
    .array(z.string())
    .min(1, "Debes asignar al menos un usuario"),
  numberInvoice: z.string().optional(),
});

// Solicitud de viaje por un USER. No lleva `assignedUserIds` (se autoasigna)
// ni `numberInvoice` (lo pone el admin al aprobar). zod sin `.strict()`
// descarta lo que no está declarado.
export const requestTripSchema = z.object({
  stages: stagesSchema,
  project: z.string().optional(),
  notes: z.string().optional(),
});

// Edición de su propia solicitud por parte del USER. Deliberadamente NO
// incluye `status`, `totalAmount`, `assignedUserIds` ni `numberInvoice`.
export const updateTripRequestSchema = z.object({
  stages: stagesSchema.optional(),
  project: z.string().optional(),
  notes: z.string().optional(),
});

// Edición completa: SOLO para las rutas de admin.
export const updateTripSchema = z.object({
  stages: stagesSchema.optional(),
  project: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]).optional(),
  assignedUserIds: z.array(z.string()).optional(),
  numberInvoice: z.string().optional(),
});

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
// Fase 2: justificación y kilometraje. El importe de un kilometraje lo
// calcula el servidor (lib/mileage.server.ts), no se fía del cliente.
const phase2ExpenseFields = {
  justification: z.string().trim().optional(),
  kmOneWay: z.number().positive().optional(),
  originOffice: z.string().optional(),
  destinationAddress: z.string().optional(),
};

export const createExpenseSchema = z.object({
  stageId: z.string().optional(), // Fase 1: tramo del viaje (si falta, por fecha)
  ...phase2ExpenseFields,
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
  stageId: z.string().optional(),
  ...phase2ExpenseFields,
  date: z.string().datetime().or(z.date()).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  invoiceNumber: z.string().optional(), // ✅ NUEVO
  paymentMethod: z.string().optional(), // ✅ NUEVO
});
