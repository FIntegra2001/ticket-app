import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  XLSX_CONTENT_TYPE,
  buildOfficeExpensesWorkbook,
  officeExportFileName,
} from "@/lib/office-expenses-export";

/** Excel con los gastos de oficina de TODOS los usuarios (solo ADMIN). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const partes = await prisma.officeExpense.findMany({
    include: {
      user: { select: { name: true, email: true } },
      expenses: { orderBy: { date: "asc" } },
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const buffer = await buildOfficeExpensesWorkbook(partes);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${officeExportFileName(
        "gastos-oficina-completo",
      )}"`,
    },
  });
}
