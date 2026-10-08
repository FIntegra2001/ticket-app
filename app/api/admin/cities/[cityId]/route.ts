import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ cityId: string }> };

// Las ciudades no se borran (los viajes antiguos las referencian): se
// desactivan para que no salgan en el formulario.
const updateCitySchema = z.object({
  name: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { cityId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = updateCitySchema.parse(await request.json());
    const city = await prisma.city.update({ where: { id: cityId }, data });
    return NextResponse.json(city);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    }
    console.error("Error updating city:", error);
    return NextResponse.json({ error: "Error al actualizar la ciudad" }, { status: 500 });
  }
}
