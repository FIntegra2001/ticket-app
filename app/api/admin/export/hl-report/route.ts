import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nightsBetween, stageCityName, toDay } from "@/lib/trip-stages";

/**
 * Reporte de viajes para la Hoja de Lunes (HL).
 *
 * Formato FIJO (copiado del Excel "Reporte viajes.xlsx" de Gabriel): 13
 * columnas, mismos colores, anchos y formatos. No cambiar sin avisarle.
 *
 * Una fila por persona y por destino: un viaje combinado sale en varias filas.
 * Viajes incluidos: los que aún no han terminado (vuelta >= hoy), en cualquier
 * estado; los rechazados salen como CANC.
 *
 * Billete: la app no distingue ida y vuelta, así que ambos salen OK (con la
 * fecha del último billete subido) si el viaje tiene algún documento BILLETE;
 * si no, PTE. En un viaje combinado, la vuelta de los destinos intermedios es
 * N/A (no se vuelve a la oficina desde ahí). Hotel: OK con la fecha de
 * confirmación; N/A si ese destino no tiene noches; si no, PTE.
 */

const HEADERS: { title: string; fill: string; width: number; date?: boolean }[] = [
  { title: "FECHA PETICIÓN", fill: "FF5B9BD5", width: 8.43, date: true },
  { title: "MES", fill: "FF5B9BD5", width: 8.43 },
  { title: "NOMBRE", fill: "FF5B9BD5", width: 8.43 },
  { title: "APELLIDOS", fill: "FF5B9BD5", width: 11.43 },
  { title: "FECHA IDA", fill: "FF5B9BD5", width: 8.43, date: true },
  { title: "FECHA VUELTA", fill: "FF5B9BD5", width: 8.43, date: true },
  { title: "DESTINO", fill: "FF5B9BD5", width: 10.57 },
  { title: "BILLETE IDA", fill: "FFC00000", width: 7.71 },
  { title: "FECHA DE COMPRA", fill: "FFFF5050", width: 8, date: true },
  { title: "BILLETE VUELTA", fill: "FF00B050", width: 7.71 },
  { title: "FECHA DE COMPRA2", fill: "FF70AD47", width: 8, date: true },
  { title: "HOTEL", fill: "FF000000", width: 7.71 },
  { title: "FECHA CONF.", fill: "FF767171", width: 8, date: true },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Mayúsculas sin tildes, salvo la Ñ (como en el Excel original)
const upper = (s: string) =>
  s
    .toUpperCase()
    .normalize("NFD")
    .replace(/Ñ/g, "Ñ")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** "Blanca Álvarez Navarro" → ["BLANCA", "ALVAREZ NAVARRO"] (primera palabra = nombre) */
function splitName(full: string | null, email: string): [string, string] {
  const parts = (full ?? email.split("@")[0]).trim().split(/\s+/);
  return [upper(parts[0] ?? ""), upper(parts.slice(1).join(" "))];
}

const border = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = toDay(new Date());
  const trips = await prisma.trip.findMany({
    where: { endDate: { gte: today } },
    include: {
      assignedUsers: { include: { user: { select: { name: true, email: true } } } },
      stages: { include: { city: true }, orderBy: { position: "asc" } },
      documents: { where: { type: "BILLETE" }, select: { createdAt: true } },
    },
    orderBy: { startDate: "asc" },
  });

  type Row = (string | Date | null)[];
  const rows: { ida: Date; row: Row }[] = [];

  for (const t of trips) {
    const cancelled = t.status === "RECHAZADO";
    const lastTicket = t.documents.length
      ? new Date(Math.max(...t.documents.map((d) => d.createdAt.getTime())))
      : null;
    // Viajes antiguos sin tramos: un tramo con los datos del viaje
    const stages = t.stages.length
      ? t.stages
      : [{ arrivalDate: t.startDate, departureDate: t.endDate, cityOther: t.city, city: null }];
    const people = t.assignedUsers.length ? t.assignedUsers.map((a) => a.user) : [{ name: "", email: "" }];

    stages.forEach((s, i) => {
      const isLast = i === stages.length - 1;
      const nights = nightsBetween(s.arrivalDate, s.departureDate);
      const ticket = cancelled ? "CANC" : lastTicket ? "OK" : "PTE";
      const ticketBack = !isLast ? "N/A" : ticket;
      const hotel = cancelled ? "CANC" : nights === 0 ? "N/A" : t.hotelConfirmedAt ? "OK" : "PTE";
      const destino = upper(stageCityName(s as Parameters<typeof stageCityName>[0]));

      for (const p of people) {
        const [nombre, apellidos] = splitName(p.name, p.email);
        rows.push({
          ida: s.arrivalDate,
          row: [
            t.createdAt,
            MESES[toDay(s.arrivalDate).getUTCMonth()],
            nombre,
            apellidos,
            toDay(s.arrivalDate),
            toDay(s.departureDate),
            destino,
            ticket,
            ticket === "OK" ? lastTicket : null,
            ticketBack,
            ticketBack === "OK" ? lastTicket : null,
            hotel,
            hotel === "OK" ? t.hotelConfirmedAt : hotel === "N/A" ? "-" : null,
          ],
        });
      }
    });
  }
  rows.sort((a, b) => a.ida.getTime() - b.ida.getTime());

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Viajes", { views: [{ showGridLines: false }] });
  ws.columns = HEADERS.map((h) => ({ width: h.width }));

  const head = ws.addRow(HEADERS.map((h) => h.title));
  head.height = 33;
  head.eachCell((cell, col) => {
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADERS[col - 1].fill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });

  rows.forEach(({ row }, i) => {
    const r = ws.addRow(row);
    r.height = 24;
    for (let col = 1; col <= HEADERS.length; col++) {
      const cell = r.getCell(col);
      cell.font = { name: "Calibri", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
      if (HEADERS[col - 1].date) cell.numFmt = "dd/mm";
      // Filas alternas en azul claro, como en el original
      if (i % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
    }
  });
  ws.autoFilter = "A1:M1";

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-viajes-HL-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
