import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { getReimbursements } from "@/lib/reimbursements.server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.role === "ADMIN" ? session : null;
}

function parsePeriod(url: string) {
  const p = new URL(url).searchParams;
  const year = Number(p.get("year"));
  const month = Number(p.get("month"));
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, month };
}

// Transferencias pendientes/hechas de un mes (?year=&month=). Solo ADMIN.
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const period = parsePeriod(request.url);
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 });
  return NextResponse.json(await getReimbursements(period.year, period.month));
}

const paySchema = z.object({
  userId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  paid: z.boolean(),
});

// Marcar (o desmarcar) como transferido. Guarda el importe del momento.
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { userId, year, month, paid } = paySchema.parse(await request.json());

    if (!paid) {
      await prisma.reimbursement.deleteMany({ where: { userId, year, month } });
      return NextResponse.json({ ok: true });
    }
    const row = (await getReimbursements(year, month)).find((r) => r.userId === userId);
    if (!row) {
      return NextResponse.json({ error: "No hay adelantos ese mes" }, { status: 404 });
    }
    const data = {
      amount: new Prisma.Decimal(row.amount),
      paidAt: new Date(),
      paidById: session.user.id,
    };
    await prisma.reimbursement.upsert({
      where: { userId_year_month: { userId, year, month } },
      create: { userId, year, month, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    }
    console.error("Error updating reimbursement:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
