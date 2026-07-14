import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { SUBCUENTAS, SUBCUENTAS_CONTABILIDAD } from "@/lib/expense-categories";

// ✅ IVA configurable (21% España)
// ⚠️ TODO (financiero): este export usa IVA_RATE=0.21 mientras que el export de
// admin (app/api/admin/export/route.ts) usa 0. Divergencia intencionada por
// ahora: unificarla afecta a los importes de todo el histórico. No tocar sin
// decisión de financiero.
const IVA_RATE = 0.21;

// SUBCUENTAS y SUBCUENTAS_CONTABILIDAD viven en @/lib/expense-categories
// (fuente única de verdad). BANCOS es específico de los exports.
const BANCOS: Record<string, string> = {
  Tarjeta: "Santander tarj debito",
  Efectivo: "Efectivo",
  Transferencia: "Santander transferencia",
  Domiciliacion: "Santander domiciliacion",
  Bankinter: "Bankinter",
};

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    where: {
      assignedUsers: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      assignedUsers: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      expenses: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const expenses = trips.flatMap((trip) =>
    trip.expenses.map((expense) => ({ trip, expense })),
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Mis Gastos");

  // ✅ Columnas en el orden exacto (sin las 7 eliminadas)
  worksheet.columns = [
    { header: "fecha", key: "fecha", width: 12 },
    { header: "MÉTODO DE PAGO", key: "metodoPago", width: 25 },
    { header: "CONCEPTO", key: "concepto", width: 20 },
    { header: "SUBCONCEPTO", key: "subconcepto", width: 25 },
    { header: "Nª Registro", key: "nRegistro", width: 12 },
    { header: "EUROS", key: "euros", width: 12 },
    { header: "IVA", key: "iva", width: 10 },
    { header: "IMPORTE IVA", key: "importeIva", width: 12 },
    { header: "IMPORTE_TOTAL", key: "importeTotal", width: 15 },
    {
      header: "subcuenta contabildad",
      key: "subcuentaContabilidad",
      width: 20,
    },
    { header: "PROVEEDOR", key: "proveedor", width: 30 },
    { header: "NIF/CIF", key: "nifcif", width: 15 },
    { header: "Nº FACTURA", key: "factura", width: 20 },
    { header: "COMENTARIOS", key: "comentarios", width: 60 },
    { header: "MES", key: "mes", width: 8 },
    { header: "Cobro", key: "cobro", width: 8 },
    { header: "mes imputacion", key: "mesImputacion", width: 15 },
    { header: "IMPUTACION", key: "imputacion", width: 12 },
    { header: "PROYECTO", key: "proyecto", width: 15 },
    { header: "Pagado", key: "pagado", width: 10 },
    { header: "Fecha Pago", key: "fechaPago", width: 12 },
    { header: "PERSONAL", key: "personal", width: 20 },
    { header: "PPTO", key: "ppto", width: 10 },
    { header: "Nº noches", key: "nNoches", width: 10 },
    { header: "Nº pax viajan", key: "nPax", width: 12 },
    { header: "Nº trayectos", key: "nTrayectos", width: 12 },
    { header: "CIUDAD", key: "ciudad", width: 15 },
  ];

  expenses.forEach(({ trip, expense }) => {
    const fechaGasto = new Date(expense.date);
    const mesNum = fechaGasto.getMonth() + 1;
    const añoGasto = fechaGasto.getFullYear();

    const categoriaInfo =
      SUBCUENTAS[expense.category ?? ""] ?? SUBCUENTAS["Taxi"];
    const userName = session.user.name || "Usuario";

    // ✅ Cálculo de IVA dinámico
    const total = Number(expense.amount);
    const base = Math.round((total / (1 + IVA_RATE)) * 100) / 100;
    const importeIva = Math.round((total - base) * 100) / 100;

    worksheet.addRow({
      fecha: formatDate(expense.date),
      metodoPago:
        BANCOS[expense.paymentMethod ?? "Tarjeta"] ?? BANCOS["Tarjeta"],
      concepto: categoriaInfo.concepto,
      subconcepto: categoriaInfo.subconcepto,
      nRegistro: "",
      euros: base,
      iva: IVA_RATE * 100,
      importeIva: importeIva,
      importeTotal: total,
      subcuentaContabilidad:
        SUBCUENTAS_CONTABILIDAD[expense.category ?? ""] ?? "",
      proveedor: expense.vendor ?? "",
      nifcif: expense.invoiceNumber ?? "",
      factura: `Liquidación - ${trip.numberInvoice ?? ""}`,
      comentarios: `Gastos de viaje ${trip.city} ${userName}${expense.description ?? ""}`,
      mes: mesNum,
      cobro: añoGasto,
      mesImputacion: mesNum,
      imputacion: añoGasto,
      proyecto: trip.project ?? "",
      pagado: "Sí",
      fechaPago: "",
      personal: userName,
      ppto: "",
      nNoches: "",
      nPax: "",
      nTrayectos: "",
      ciudad: trip.city,
    });
  });

  // Estilos header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F2FD" },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Mis-Gastos-${session.user.name?.replace(/\s/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
