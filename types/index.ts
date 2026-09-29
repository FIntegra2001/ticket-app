export type UserRole = "USER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
};

export type TripStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO";

// ✅ NUEVO: asignación
export interface TripAssignment {
  id: string;
  tripId: string;
  userId: string;
  user?: User;
  createdAt: Date;
}

// 🆕 Documentos que el admin adjunta al viaje (billete, reserva de hotel)
export type TripDocumentType = "BILLETE" | "RESERVA" | "OTRO";

export interface TripDocument {
  id: string;
  tripId: string;
  type: TripDocumentType;
  url: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById?: string | null;
  createdAt: Date | string;
}

export interface Trip {
  id: string;
  createdByAdminId?: string | null // 🆕 null si lo solicitó un USER
  createdByAdmin?: User           // ✅ NUEVO
  requestedById?: string | null    // 🆕 USER que solicitó el viaje
  requestedBy?: User | null        // 🆕
  approvedAt?: Date | string | null // 🆕
  approvedById?: string | null      // 🆕
  approvedBy?: User | null          // 🆕
  city: string;
  startDate: Date | string;
  endDate: Date | string;
  project?: string | null;
  notes?: string | null;
  status: TripStatus;
  totalAmount: number;
  numberInvoice?: string ;
  createdAt: Date;
  updatedAt: Date;
  assignedUsers?: TripAssignment[] // ✅ NUEVO (reemplaza a user)
  expenses?: Expense[];
  /**
   * 🆕 Referencia ligera a los documentos: las rutas de trip solo devuelven
   * `id` y `type`, lo justo para los badges "Billete ✓ / Reserva ✓". El
   * documento completo (url, fileName…) se pide a /api/trips/[id]/documents.
   */
  documents?: Pick<TripDocument, "id" | "type">[]
}

// ✅ NUEVO: DTO para crear viaje (solo admin)
export interface CreateTripDto {
  city: string;
  startDate: Date;
  endDate: Date;
  project?: string;
  notes?: string;
  numberInvoice?: string;
  assignedUserIds: string[]        // ✅ NUEVO: uno o varios usuarios
}

// 🆕 DTO para que un USER solicite un viaje: no elige nº de factura ni asignados
export interface RequestTripDto {
  city: string;
  startDate: Date;
  endDate: Date;
  project?: string;
  notes?: string;
}

export interface UpdateTripDto {
  city?: string;
  startDate?: Date;
  endDate?: Date;
  project?: string;
  notes?: string;
  status?: TripStatus;
  numberInvoice?: string ;
  assignedUserIds?: string[]       // ✅ NUEVO
}

export interface TripFormDto {
  city: string;
  startDate: string;
  endDate: string;
  project?: string;
  notes?: string;
  numberInvoice?: string ;
  assignedUserIds: string[]        // ✅ NUEVO
}

// 🆕 Parte de gastos de oficina: la cabecera a la que se cuelgan los gastos que
// NO son de viaje. Un único parte por usuario y mes.
export type OfficeExpenseStatus = "ABIERTO" | "CERRADO";

export interface OfficeExpense {
  id: string;
  userId: string;
  user?: User;
  year: number;
  month: number;
  title?: string | null;
  notes?: string | null;
  status: OfficeExpenseStatus;
  totalAmount: number;
  expenses?: Expense[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateOfficeExpenseDto {
  year: number;
  month: number;
  title?: string;
  notes?: string;
}

export interface UpdateOfficeExpenseDto {
  title?: string;
  notes?: string;
  status?: OfficeExpenseStatus;
}

// Un Expense cuelga de un Trip O de un OfficeExpense, nunca de los dos.
export interface Expense {
  id: string;
  tripId?: string | null;
  officeExpenseId?: string | null;  // 🆕
  date: Date;
  amount: number;
  category?: string | null;        // incluye "Billete" ← NUEVO
  vendor?: string | null;
  description?: string | null;
  receiptUrl?: string | null;
  invoiceNumber?: string | null;
  paymentMethod?: string | null;
  createdByAdminId?: string | null // ✅ NUEVO
  createdAt: Date;
  updatedAt: Date;
  trip?: Trip;
  officeExpense?: OfficeExpense;   // 🆕
}

export interface CreateExpenseDto {
  tripId?: string;
  officeExpenseId?: string;        // 🆕
  date: Date;
  amount: number;
  category?: string;
  vendor?: string;
  description?: string;
  receiptUrl?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
}

export interface UpdateExpenseDto {
  date?: Date;
  amount?: number;
  category?: string;
  vendor?: string;
  description?: string;
  receiptUrl?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
}

export interface PaginatedResponse<T> {
  trips: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}