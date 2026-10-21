import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ projectId: string }> };

// Activar / desactivar un proyecto. Los gastos ya imputados no cambian.
const schema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = schema.parse(await request.json());
    const project = await prisma.project.update({ where: { id: projectId }, data });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    }
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Error al actualizar el proyecto" }, { status: 500 });
  }
}
