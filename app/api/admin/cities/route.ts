import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const createCitySchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre"),
  region: z.string().trim().min(1, "Falta la comunidad autónoma"),
});

// Alta de ciudad en el catálogo. Solo ADMIN.
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = createCitySchema.parse(await request.json());

    const exists = await prisma.city.findUnique({ where: { name: data.name } });
    if (exists) {
      return NextResponse.json({ error: "Esa ciudad ya existe" }, { status: 409 });
    }
    const max = await prisma.city.aggregate({ _max: { sortOrder: true } });
    const city = await prisma.city.create({
      data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    return NextResponse.json(city, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
    }
    console.error("Error creating city:", error);
    return NextResponse.json({ error: "Error al crear la ciudad" }, { status: 500 });
  }
}
