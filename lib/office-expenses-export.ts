// ============================================================================
// Generador del Excel de gastos de OFICINA, compartido por los dos exports
// (el de admin y el del propio usuario).
//
// Está en un módulo único a propósito: los dos exports de VIAJE se escribieron
// por separado y han divergido — distinto IVA_RATE (0 vs 0.21), distinto formato
// de "Nº FACTURA", distintos COMENTARIOS y distinto ancho de columna. Aquí no
// puede pasar: quien cambie una columna la cambia para los dos.
// ============================================================================

import ExcelJS from "exceljs";
import { SUBCUENTAS, SUBCUENTAS_CONTABILIDAD } from "@/lib/expense-categories";
// MESES vive en lib/office-expenses.ts: un solo sitio para los nombres de mes
import { MESES } from "@/lib/office-expenses";

/**
 * Sin desglose de IVA: `EUROS` = importe total e `IVA` = 0.
 *
 * Es la misma convención que usa hoy el export de admin de viajes. ⚠️ Los dos
 * exports de viaje NO coinciden entre sí (admin 0 / usuario 0,21) y esa deuda
 * sigue abierta con financiero; aquí se arranca con un único valor para los dos,
 * en un solo sitio, para no heredar el problema.
 */
const IVA_RATE = 0;

const BANCOS: Record<string, string> = {
  Tarjeta: "Santander tarj debito",
  Efectivo: "Efectivo",
  Transferencia: "Santander transferencia",
  Domiciliacion: "Santander domiciliacion",
  Bankinter: "Bankinter",
};

/** Forma mínima que necesita el generador; encaja con lo que devuelve Prisma. */
export type OfficeExpenseForExport = {
  year: number;
  month: number;
  title: string | null;
  user: { name: string | null; email: string } | null;
  expenses: {
    date: Date;
    amount: unknown; // Prisma.Decimal
    category: string | null;
    vendor: string | null;
    description: string | null;
    invoiceNumber: string | null;
    paymentMethod: string | null;
  }[];
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Construye el libro con las mismas 27 columnas y el mismo orden que los
 * exports de viaje, para que financiero reciba un formato que ya reconoce.
 * Las columnas que no aplican a oficina van vacías: CIUDAD, PROYECTO,
 * Nº FACTURA, Nº noches, Nº pax y Nº trayectos.
 */
export async function buildOfficeExpensesWorkbook(
  partes: OfficeExpenseForExport[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Gastos Oficina");

  worksheet.columns = [
    { header: "fecha",                 key: "fecha",                 width: 12 },
    { header: "MÉTODO DE PAGO",        key: "metodoPago",            width: 25 },
    { header: "CONCEPTO",              key: "concepto",              width: 25 },
    { header: "SUBCONCEPTO",           key: "subconcepto",           width: 25 },
    { header: "Nª Registro",           key: "nRegistro",             width: 12 },
    { header: "EUROS",                 key: "euros",                 width: 12 },
    { header: "IVA",                   key: "iva",                   width: 10 },
    { header: "IMPORTE IVA",           key: "importeIva",            width: 12 },
    { header: "IMPORTE_TOTAL",         key: "importeTotal",          width: 15 },
    { header: "subcuenta contabildad", key: "subcuentaContabilidad", width: 20 },
    { header: "PROVEEDOR",             key: "proveedor",             width: 30 },
    { header: "NIF/CIF",               key: "nifcif",                width: 15 },
    { header: "Nº FACTURA",            key: "factura",               width: 20 },
    { header: "COMENTARIOS",           key: "comentarios",           width: 60 },
    { header: "MES",                   key: "mes",                   width: 8  },
    { header: "Cobro",                 key: "cobro",                 width: 8  },
    { header: "mes imputacion",        key: "mesImputacion",         width: 15 },
    { header: "IMPUTACION",            key: "imputacion",            width: 12 },
    { header: "PROYECTO",              key: "proyecto",              width: 15 },
    { header: "Pagado",                key: "pagado",                width: 10 },
    { header: "Fecha Pago",            key: "fechaPago",             width: 12 },
    { header: "PERSONAL",              key: "personal",              width: 20 },
    { header: "PPTO",                  key: "ppto",                  width: 10 },
    { header: "Nº noches",             key: "nNoches",               width: 10 },
    { header: "Nº pax viajan",         key: "nPax",                  width: 12 },
    { header: "Nº trayectos",          key: "nTrayectos",            width: 12 },
    { header: "CIUDAD",                key: "ciudad",                width: 15 },
  ];

  partes.forEach((parte) => {
    const personal = parte.user?.name ?? parte.user?.email ?? "Usuario";
    const nombreMes = MESES[parte.month - 1] ?? String(parte.month);

    parte.expenses.forEach((expense) => {
      const fechaGasto = new Date(expense.date);
      const mesNum = fechaGasto.getMonth() + 1;
      const añoGasto = fechaGasto.getFullYear();

      // El fallback a "Taxi" de los exports de viaje NO se replica aquí: en
      // oficina la categoría se valida contra el scope al crear el gasto, así
      // que no puede llegar un valor desconocido. Si llegase, preferimos la
      // celda vacía a una imputación silenciosamente equivocada.
      const categoriaInfo = SUBCUENTAS[expense.category ?? ""];

      const total = Number(expense.amount);
      const base = Math.round((total / (1 + IVA_RATE)) * 100) / 100;
      const importeIva = Math.round((total - base) * 100) / 100;

      worksheet.addRow({
        fecha: formatDate(expense.date),
        metodoPago:
          BANCOS[expense.paymentMethod ?? "Tarjeta"] ?? BANCOS["Tarjeta"],
        concepto: categoriaInfo?.concepto ?? "",
        subconcepto: categoriaInfo?.subconcepto ?? "",
        nRegistro: "",
        euros: base,
        iva: IVA_RATE * 100,
        importeIva,
        importeTotal: total,
        subcuentaContabilidad:
          SUBCUENTAS_CONTABILIDAD[expense.category ?? ""] ?? "",
        proveedor: expense.vendor ?? "",
        nifcif: expense.invoiceNumber ?? "",
        // Los gastos de oficina no tienen nº de factura interno: no hay viaje
        factura: "",
        comentarios: `Gastos de oficina ${nombreMes} ${parte.year} ${personal}${
          expense.description ? ` - ${expense.description}` : ""
        }`,
        mes: mesNum,
        cobro: añoGasto,
        mesImputacion: mesNum,
        imputacion: añoGasto,
        proyecto: "",
        pagado: "Sí",
        fechaPago: "",
        personal,
        ppto: "",
        nNoches: "",
        nPax: "",
        nTrayectos: "",
        ciudad: "",
      });
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F2FD" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

export function officeExportFileName(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
