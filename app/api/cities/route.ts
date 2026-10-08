import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Catálogo de ciudades para el formulario de viajes. Cualquier usuario activo.
// ?all=1 (solo ADMIN) incluye también las desactivadas.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const all =
      new URL(request.url).searchParams.get("all") === "1" &&
      session.user.role === "ADMIN";

    const cities = await prisma.city.findMany({
      where: all ? {} : { active: true },
      // "Otro (especificar)" siempre al final
      orderBy: [{ isOther: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json({ error: "Error al cargar ciudades" }, { status: 500 });
  }
}
