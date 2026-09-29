import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ tripId: string }>;
};

// ✅ Helper reutilizable: verifica que el usuario tiene acceso al trip
// Admin puede acceder a cualquier trip, User solo a los asignados
async function verifyTripAccess(tripId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return prisma.trip.findUnique({ where: { id: tripId } });
  }

  return prisma.trip.findFirst({
    where: {
      id: tripId,
      assignedUsers: {
        some: { userId },
      },
    },
  });
}

// 🆕 Candado del flujo de aprobación: un USER solo puede tocar gastos de viajes
// APROBADOS. Una solicitud PENDIENTE o un viaje RECHAZADO no admiten gastos.
// El ADMIN no se bloquea: tiene que poder corregir en cualquier estado.
const EXPENSES_LOCKED_MSG =
  "Este viaje todavía no está aprobado, así que no admite gastos. En cuanto administración lo apruebe podrás cargarlos.";

function expensesLocked(
  trip: { status: string },
  isAdmin: boolean,
): boolean {
  return !isAdmin && trip.status !== "APROBADO";
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Verificar acceso al trip por asignación (o admin)
    const isAdmin = session.user.role === "ADMIN";
    const trip = await verifyTripAccess(tripId, session.user.id, isAdmin);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Error fetching expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { tripId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Verificar acceso al trip por asignación (o admin)
    const isAdmin = session.user.role === "ADMIN";
    const trip = await verifyTripAccess(tripId, session.user.id, isAdmin);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (expensesLocked(trip, isAdmin)) {
      return NextResponse.json({ error: EXPENSES_LOCKED_MSG }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createExpenseSchema.parse(body);

    // ✅ Crear expense y actualizar total en una transacción
    const [expense] = await prisma.$transaction([
      prisma.expense.create({
        data: {
          tripId,
          amount: new Prisma.Decimal(validatedData.amount),
          date: new Date(validatedData.date),
          category: validatedData.category,
          vendor: validatedData.vendor,
          description: validatedData.description,
          receiptUrl: validatedData.receiptUrl,
          invoiceNumber: validatedData.invoiceNumber,
          paymentMethod: validatedData.paymentMethod,
          // ✅ Guardar quién creó el gasto (null si es user)
          createdByAdminId: isAdmin ? session.user.id : null,
        },
      }),
      prisma.trip.update({
        where: { id: tripId },
        data: {
          totalAmount: {
            increment: validatedData.amount,
          },
        },
      }),
    ]);

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Error creating expense" },
      { status: 500 }
    );
  }
}