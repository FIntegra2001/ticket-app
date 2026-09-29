import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createOfficeExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Partes de gastos de oficina del usuario en sesión.
 *
 * A diferencia de los viajes, los gastos de oficina NO pasan por aprobación: el
 * usuario crea el parte del mes y carga sus tickets directamente. El admin los
 * ve y los exporta después.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    const where = { userId: session.user.id };

    const [officeExpenses, totalCount] = await Promise.all([
      prisma.officeExpense.findMany({
        where,
        include: { expenses: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip,
        take: limit,
      }),
      prisma.officeExpense.count({ where }),
    ]);

    return NextResponse.json({
      officeExpenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + officeExpenses.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching office expenses:", error);
    return NextResponse.json(
      { error: "Error al cargar los gastos de oficina" },
      { status: 500 },
    );
  }
}

/**
 * Crea el parte del mes.
 *
 * Hay un `@@unique([userId, year, month])` en el schema: un parte por usuario y
 * mes. Si ya existe, se devuelve el existente con un 200 en vez de un error —
 * desde la UI el usuario ha pedido "el parte de octubre" y lo que espera es
 * acabar dentro de él, no ver un fallo.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOfficeExpenseSchema.parse(body);

    const existing = await prisma.officeExpense.findUnique({
      where: {
        userId_year_month: {
          userId: session.user.id,
          year: data.year,
          month: data.month,
        },
      },
      include: { expenses: true },
    });

    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }

    const created = await prisma.officeExpense.create({
      data: {
        userId: session.user.id,
        year: data.year,
        month: data.month,
        title: data.title,
        notes: data.notes,
      },
      include: { expenses: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error creating office expense:", error);
    return NextResponse.json(
      { error: "Error al crear el parte de gastos" },
      { status: 500 },
    );
  }
}
