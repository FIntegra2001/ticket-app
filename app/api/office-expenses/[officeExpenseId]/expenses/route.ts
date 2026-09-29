import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isValidCategoryForScope } from "@/lib/expense-categories";
import { createExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ officeExpenseId: string }>;
};

/**
 * Gastos de un parte de oficina. Espejo de
 * app/api/trips/[tripId]/expenses/route.ts con `officeExpenseId` en lugar de
 * `tripId` y el mismo patrón de total incremental en transacción.
 *
 * Diferencia con las rutas de viaje: aquí SÍ se valida la categoría contra el
 * scope "office". Las de viaje aceptan cualquier string (deuda heredada), pero
 * en oficina no queremos arrancar con esa puerta abierta: una categoría de viaje
 * en un parte de oficina iría a la cuenta contable equivocada sin avisar.
 */
async function verifyAccess(
  officeExpenseId: string,
  userId: string,
  isAdmin: boolean,
) {
  return prisma.officeExpense.findFirst({
    where: isAdmin ? { id: officeExpenseId } : { id: officeExpenseId, userId },
    select: { id: true, status: true },
  });
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { officeExpenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parte = await verifyAccess(
      officeExpenseId,
      session.user.id,
      session.user.role === "ADMIN",
    );

    if (!parte) {
      return NextResponse.json({ error: "Parte no encontrado" }, { status: 404 });
    }

    const expenses = await prisma.expense.findMany({
      where: { officeExpenseId },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching office expenses items:", error);
    return NextResponse.json(
      { error: "Error al cargar los gastos" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { officeExpenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const parte = await verifyAccess(officeExpenseId, session.user.id, isAdmin);

    if (!parte) {
      return NextResponse.json({ error: "Parte no encontrado" }, { status: 404 });
    }

    if (parte.status === "CERRADO" && !isAdmin) {
      return NextResponse.json(
        {
          error:
            "Este parte está cerrado y no admite gastos nuevos. Pide a administración que lo reabra.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validatedData = createExpenseSchema.parse(body);

    // Categoría obligatoria y del scope correcto: sin esto, un gasto de oficina
    // podría entrar con "Taxi" (62900000006, viaje) en vez de "TaxiOficina"
    // (62900000019) y saldría mal en el Excel sin que nadie lo note.
    if (!isValidCategoryForScope(validatedData.category, "office")) {
      return NextResponse.json(
        {
          error:
            "Elige una categoría de gasto de oficina válida antes de guardar.",
        },
        { status: 400 },
      );
    }

    const [expense] = await prisma.$transaction([
      prisma.expense.create({
        data: {
          officeExpenseId,
          amount: new Prisma.Decimal(validatedData.amount),
          date: new Date(validatedData.date),
          category: validatedData.category,
          vendor: validatedData.vendor,
          description: validatedData.description,
          receiptUrl: validatedData.receiptUrl,
          invoiceNumber: validatedData.invoiceNumber,
          paymentMethod: validatedData.paymentMethod,
          createdByAdminId: isAdmin ? session.user.id : null,
        },
      }),
      prisma.officeExpense.update({
        where: { id: officeExpenseId },
        data: { totalAmount: { increment: validatedData.amount } },
      }),
    ]);

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error creating office expense item:", error);
    return NextResponse.json(
      { error: "Error al crear el gasto" },
      { status: 500 },
    );
  }
}
