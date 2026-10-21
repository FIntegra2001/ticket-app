import prisma from "@/lib/db";
import { NextResponse } from "next/server";

// Fase 3: proyectos activos con sus códigos por delegación (formularios de
// viaje y de gasto). La sesión la exige proxy.ts.
export async function GET() {
  const projects = await prisma.project.findMany({
    where: { active: true },
    include: { allocations: { select: { delegation: true, accountingCode: true } } },
    orderBy: [{ code: "asc" }, { year: "desc" }],
  });
  return NextResponse.json(projects);
}
