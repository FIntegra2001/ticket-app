import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.role === "ADMIN" ? session : null;
}

// Historial de tarifas de kilometraje. Solo ADMIN.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rates = await prisma.mileageRate.findMany({ orderBy: { validFrom: "desc" } });
  return NextResponse.json(rates.map((r) => ({ ...r, ratePerKm: Number(r.ratePerKm) })));
}

const createRateSchema = z.object({
  ratePerKm: z.number().positive().max(5),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Nueva tarifa a partir de una fecha. No modifica los gastos ya guardados.
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const data = createRateSchema.parse(await request.json());
    const rate = await prisma.mileageRate.create({
      data: {
        ratePerKm: new Prisma.Decimal(data.ratePerKm),
        validFrom: new Date(`${data.validFrom}T00:00:00Z`),
        createdById: session.user.id,
      },
    });
    return NextResponse.json({ ...rate, ratePerKm: Number(rate.ratePerKm) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Tarifa o fecha no válidas" }, { status: 400 });
    }
    console.error("Error creating mileage rate:", error);
    return NextResponse.json({ error: "Error al guardar la tarifa" }, { status: 500 });
  }
}
