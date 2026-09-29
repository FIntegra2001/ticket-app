import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { TRIP_STATUS_SHORT_LABEL } from "@/lib/trip-status";

/**
 * Excel de RESUMEN DE VIAJES: una fila por viaje, sin gastos.
 *
 * Es un export distinto del de /api/admin/export (que saca una fila por gasto
 * con las 27 columnas contables). Este sirve para control de gestión: ver de un
 * vistazo el estado de cada viaje, quién lo pidió, cuándo se aprobó y si tiene
 * el billete comprado y el hotel reservado.
 *
 * No lleva importes desglosados ni IVA, así que no le afecta la divergencia de
 * IVA_RATE pendiente con financiero.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    include: {
      assignedUsers: {
        include: { user: { select: { name: true, email: true } } },
      },
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      documents: { select: { type: true } },
      _count: { select: { expenses: true } },
    },
    orderBy: { startDate: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Resumen Viajes");

  worksheet.columns = [
    { header: "Nº FACTURA",        key: "factura",        width: 18 },
    { header: "CIUDAD",            key: "ciudad",         width: 15 },
    { header: "PROYECTO",          key: "proyecto",       width: 20 },
    { header: "ESTADO",            key: "estado",         width: 12 },
    { header: "ORIGEN",            key: "origen",         width: 10 },
    { header: "SOLICITADO POR",    key: "solicitadoPor",  width: 25 },
    { header: "FECHA SOLICITUD",   key: "fechaSolicitud", width: 16 },
    { header: "FECHA APROBACIÓN",  key: "fechaAprobacion",width: 16 },
    { header: "APROBADO POR",      key: "aprobadoPor",    width: 25 },
    { header: "FECHA INICIO",      key: "fechaInicio",    width: 14 },
    { header: "FECHA FIN",         key: "fechaFin",       width: 14 },
    { header: "Nº NOCHES",         key: "nNoches",        width: 10 },
    { header: "PERSONAL",          key: "personal",       width: 30 },
    { header: "BILLETE",           key: "billete",        width: 10 },
    { header: "RESERVA HOTEL",     key: "reservaHotel",   width: 14 },
    { header: "Nº GASTOS",         key: "nGastos",        width: 10 },
    { header: "TOTAL",             key: "total",          width: 14 },
    { header: "NOTAS",             key: "notas",          width: 50 },
  ];

  trips.forEach((trip) => {
    const personal =
      trip.assignedUsers
        .map((a) => a.user.name ?? a.user.email)
        .join(", ") || "Sin asignar";

    // Noches = diferencia en días entre fin e inicio. Un viaje de ida y vuelta
    // el mismo día son 0 noches, no 1.
    const msPorDia = 1000 * 60 * 60 * 24;
    const nNoches = Math.max(
      0,
      Math.round(
        (new Date(trip.endDate).getTime() -
          new Date(trip.startDate).getTime()) /
          msPorDia,
      ),
    );

    const tieneDoc = (type: "BILLETE" | "RESERVA") =>
      trip.documents.some((d) => d.type === type) ? "Sí" : "No";

    worksheet.addRow({
      factura: trip.numberInvoice ?? "",
      ciudad: trip.city,
      proyecto: trip.project ?? "",
      estado: TRIP_STATUS_SHORT_LABEL[trip.status],
      // `requestedById` es lo que distingue una solicitud de un viaje que el
      // admin creó directamente
      origen: trip.requestedById ? "Usuario" : "Admin",
      solicitadoPor:
        trip.requestedBy?.name ?? trip.requestedBy?.email ?? "—",
      fechaSolicitud: formatDate(trip.createdAt),
      fechaAprobacion: trip.approvedAt ? formatDate(trip.approvedAt) : "",
      aprobadoPor: trip.approvedBy?.name ?? trip.approvedBy?.email ?? "",
      fechaInicio: formatDate(trip.startDate),
      fechaFin: formatDate(trip.endDate),
      nNoches,
      personal,
      billete: tieneDoc("BILLETE"),
      reservaHotel: tieneDoc("RESERVA"),
      nGastos: trip._count.expenses,
      total: Number(trip.totalAmount),
      notas: trip.notes ?? "",
    });
  });

  // Mismo estilo de cabecera que los otros exports, para que financiero
  // reconozca el formato
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F2FD" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resumen-viajes-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
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
