import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { updateOfficeExpenseSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type Params = {
  params: Promise<{ officeExpenseId: string }>;
};

/**
 * Acceso a un parte: su dueño o un admin.
 * Devuelve null si el usuario no tiene permiso, para responder 404 sin filtrar
 * si el parte existe o es de otro.
 */
async function findAccessible(
  officeExpenseId: string,
  userId: string,
  isAdmin: boolean,
) {
  return prisma.officeExpense.findFirst({
    where: isAdmin
      ? { id: officeExpenseId }
      : { id: officeExpenseId, userId },
    include: {
      expenses: { orderBy: { date: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { officeExpenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parte = await findAccessible(
      officeExpenseId,
      session.user.id,
      session.user.role === "ADMIN",
    );

    if (!parte) {
      return NextResponse.json({ error: "Parte no encontrado" }, { status: 404 });
    }

    return NextResponse.json(parte);
  } catch (error) {
    console.error("Error fetching office expense:", error);
    return NextResponse.json(
      { error: "Error al cargar el parte" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { officeExpenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const parte = await findAccessible(officeExpenseId, session.user.id, isAdmin);

    if (!parte) {
      return NextResponse.json({ error: "Parte no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateOfficeExpenseSchema.parse(body);

    // Un parte CERRADO ya no se toca: es la señal de que el usuario lo ha dado
    // por terminado y contabilidad puede exportarlo. Reabrirlo es cosa del admin.
    if (parte.status === "CERRADO" && !isAdmin && data.status !== "ABIERTO") {
      return NextResponse.json(
        { error: "Este parte está cerrado. Pide a administración que lo reabra." },
        { status: 403 },
      );
    }

    const updated = await prisma.officeExpense.update({
      where: { id: officeExpenseId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        expenses: { orderBy: { date: "desc" } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error updating office expense:", error);
    return NextResponse.json(
      { error: "Error al actualizar el parte" },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { officeExpenseId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const parte = await findAccessible(officeExpenseId, session.user.id, isAdmin);

    if (!parte) {
      return NextResponse.json({ error: "Parte no encontrado" }, { status: 404 });
    }

    if (parte.status === "CERRADO" && !isAdmin) {
      return NextResponse.json(
        { error: "No puedes eliminar un parte cerrado." },
        { status: 403 },
      );
    }

    // La cascada de Prisma borra los gastos del parte
    await prisma.officeExpense.delete({ where: { id: officeExpenseId } });

    return NextResponse.json({ ok: true, message: "Parte eliminado" });
  } catch (error) {
    console.error("Error deleting office expense:", error);
    return NextResponse.json(
      { error: "Error al eliminar el parte" },
      { status: 500 },
    );
  }
}
