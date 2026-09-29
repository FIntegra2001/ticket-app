import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/** Todos los partes de gastos de oficina, de todos los usuarios (solo ADMIN). */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "15");
    const skip = (page - 1) * limit;

    const [officeExpenses, totalCount] = await Promise.all([
      prisma.officeExpense.findMany({
        include: {
          expenses: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip,
        take: limit,
      }),
      prisma.officeExpense.count(),
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
    console.error("Error fetching admin office expenses:", error);
    return NextResponse.json(
      { error: "Error al cargar los gastos de oficina" },
      { status: 500 },
    );
  }
}
