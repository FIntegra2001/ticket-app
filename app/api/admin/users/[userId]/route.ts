import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

type Params = {
  params: Promise<{ userId: string }>;
};

const updateUserSchema = z
  .object({
    status: z.enum(["PENDIENTE", "ACTIVO", "BLOQUEADO"]).optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
  })
  .refine((d) => d.status || d.role, { message: "Nada que actualizar" });

// Aprobar / bloquear / cambiar rol de un usuario. Solo ADMIN.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = updateUserSchema.parse(await request.json());

    // Un admin no puede quitarse a sí mismo el acceso ni el rol: evita
    // quedarse sin ningún administrador por error.
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio estado o rol" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    // Al bloquear, se cierran sus sesiones abiertas
    if (data.status === "BLOQUEADO") {
      await prisma.session.deleteMany({ where: { userId } });
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error },
        { status: 400 },
      );
    }
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}
