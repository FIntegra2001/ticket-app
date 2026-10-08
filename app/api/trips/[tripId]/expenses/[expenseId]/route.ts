import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { updateExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resolveExpenseStage, StageError } from "@/lib/trip-stages.server";

type Params = {
  params: Promise<{ tripId: string; expenseId: string }>;
};

// ✅ Helper: verifica que el usuario tiene acceso al expense
// Comprueba que el expense pertenece al trip Y que el user tiene acceso al trip
async function verifyExpenseAccess(
  expenseId: string,
  tripId: string,
  userId: string,
  isAdmin: boolean
) {
  // Se incluye el status del viaje para poder aplicar el candado de aprobación
  const include = { trip: { select: { status: true } } } as const;

  if (isAdmin) {
    // Admin puede acceder a cualquier expense
    return prisma.expense.findFirst({
      where: { id: expenseId, tripId },
      include,
    });
  }

  // User solo puede acceder a expenses de trips asignados a él
  return prisma.expense.findFirst({
    where: {
      id: expenseId,
      tripId,
      trip: {
        assignedUsers: {
          some: { userId },
        },
      },
    },
    include,
  });
}

// 🆕 Mismo candado que en la ruta de creación: un USER no toca gastos de un
// viaje que no esté APROBADO. El ADMIN sí, para poder corregir.
const EXPENSES_LOCKED_MSG =
  "Este viaje no está aprobado, así que sus gastos no se pueden modificar.";

function expensesLocked(
  expense: { trip: { status: string } | null },
  isAdmin: boolean,
): boolean {
  return !isAdmin && expense.trip?.status !== "APROBADO";
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { tripId, expenseId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    // ✅ Verificar acceso al expense
    const existingExpense = await verifyExpenseAccess(
      expenseId,
      tripId,
      session.user.id,
      isAdmin
    );

    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expensesLocked(existingExpense, isAdmin)) {
      return NextResponse.json({ error: EXPENSES_LOCKED_MSG }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateExpenseSchema.parse(body);

    // Construir objeto de actualización
    const updateData: Prisma.ExpenseUpdateInput = {};

    if (validatedData.date !== undefined) {
      updateData.date = new Date(validatedData.date);
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(validatedData.amount);
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }
    if (validatedData.vendor !== undefined) {
      updateData.vendor = validatedData.vendor;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.receiptUrl !== undefined) {
      updateData.receiptUrl = validatedData.receiptUrl;
    }
    if (validatedData.invoiceNumber !== undefined) {
      updateData.invoiceNumber = validatedData.invoiceNumber;
    }
    if (validatedData.paymentMethod !== undefined) {
      updateData.paymentMethod = validatedData.paymentMethod;
    }
    // Fase 1: cambio de tramo (debe ser de este viaje)
    if (validatedData.stageId !== undefined) {
      const stageId = await resolveExpenseStage(
        tripId,
        new Date(),
        validatedData.stageId,
      );
      updateData.stage = stageId ? { connect: { id: stageId } } : { disconnect: true };
    }

    // ✅ Si cambia el amount, actualizar el total del trip en transacción
    let expense;
    if (validatedData.amount !== undefined) {
      const amountDifference =
        validatedData.amount - Number(existingExpense.amount);

      const [updatedExpense] = await prisma.$transaction([
        prisma.expense.update({
          where: { id: expenseId },
          data: updateData,
        }),
        prisma.trip.update({
          where: { id: tripId },
          data: {
            totalAmount: {
              increment: amountDifference,
            },
          },
        }),
      ]);
      expense = updatedExpense;
    } else {
      expense = await prisma.expense.update({
        where: { id: expenseId },
        data: updateData,
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof StageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: "Error updating expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { tripId, expenseId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    // ✅ Verificar acceso al expense
    const existingExpense = await verifyExpenseAccess(
      expenseId,
      tripId,
      session.user.id,
      isAdmin
    );

    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expensesLocked(existingExpense, isAdmin)) {
      return NextResponse.json({ error: EXPENSES_LOCKED_MSG }, { status: 403 });
    }

    // ✅ Eliminar expense y actualizar total en transacción
    await prisma.$transaction([
      prisma.expense.delete({
        where: { id: expenseId },
      }),
      prisma.trip.update({
        where: { id: tripId },
        data: {
          totalAmount: {
            decrement: Number(existingExpense.amount),
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Error deleting expense" },
      { status: 500 }
    );
  }
}