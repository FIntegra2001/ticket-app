import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { isValidCategoryForScope } from "@/lib/expense-categories";
import { updateExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ officeExpenseId: string; expenseId: string }>;
};

/** Espejo de app/api/trips/[tripId]/expenses/[expenseId]/route.ts. */
async function verifyExpenseAccess(
  expenseId: string,
  officeExpenseId: string,
  userId: string,
  isAdmin: boolean,
) {
  return prisma.expense.findFirst({
    where: {
      id: expenseId,
      officeExpenseId,
      ...(isAdmin ? {} : { officeExpense: { userId } }),
    },
    include: { officeExpense: { select: { status: true } } },
  });
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { officeExpenseId, expenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const existing = await verifyExpenseAccess(
      expenseId,
      officeExpenseId,
      session.user.id,
      isAdmin,
    );

    if (!existing) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    if (existing.officeExpense?.status === "CERRADO" && !isAdmin) {
      return NextResponse.json(
        { error: "Este parte está cerrado y no se puede modificar." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validatedData = updateExpenseSchema.parse(body);

    // Si se cambia la categoría, tiene que seguir siendo del scope "office"
    if (
      validatedData.category !== undefined &&
      !isValidCategoryForScope(validatedData.category, "office")
    ) {
      return NextResponse.json(
        { error: "Categoría no válida para un gasto de oficina." },
        { status: 400 },
      );
    }

    const updateData: Prisma.ExpenseUpdateInput = {};

    if (validatedData.date !== undefined)
      updateData.date = new Date(validatedData.date);
    if (validatedData.amount !== undefined)
      updateData.amount = new Prisma.Decimal(validatedData.amount);
    if (validatedData.category !== undefined)
      updateData.category = validatedData.category;
    if (validatedData.vendor !== undefined)
      updateData.vendor = validatedData.vendor;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.receiptUrl !== undefined)
      updateData.receiptUrl = validatedData.receiptUrl;
    if (validatedData.invoiceNumber !== undefined)
      updateData.invoiceNumber = validatedData.invoiceNumber;
    if (validatedData.paymentMethod !== undefined)
      updateData.paymentMethod = validatedData.paymentMethod;

    let expense;
    if (validatedData.amount !== undefined) {
      const amountDifference =
        validatedData.amount - Number(existing.amount);

      const [updated] = await prisma.$transaction([
        prisma.expense.update({ where: { id: expenseId }, data: updateData }),
        prisma.officeExpense.update({
          where: { id: officeExpenseId },
          data: { totalAmount: { increment: amountDifference } },
        }),
      ]);
      expense = updated;
    } else {
      expense = await prisma.expense.update({
        where: { id: expenseId },
        data: updateData,
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error updating office expense item:", error);
    return NextResponse.json(
      { error: "Error al actualizar el gasto" },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { officeExpenseId, expenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const existing = await verifyExpenseAccess(
      expenseId,
      officeExpenseId,
      session.user.id,
      isAdmin,
    );

    if (!existing) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    if (existing.officeExpense?.status === "CERRADO" && !isAdmin) {
      return NextResponse.json(
        { error: "Este parte está cerrado y no se puede modificar." },
        { status: 403 },
      );
    }

    await prisma.$transaction([
      prisma.expense.delete({ where: { id: expenseId } }),
      prisma.officeExpense.update({
        where: { id: officeExpenseId },
        data: { totalAmount: { decrement: Number(existing.amount) } },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Gasto eliminado" });
  } catch (error) {
    console.error("Error deleting office expense item:", error);
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 },
    );
  }
}
