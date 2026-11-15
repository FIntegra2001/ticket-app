import prisma from "@/lib/db";
import { syncIfStale } from "@/lib/maestros-sync.server";
import { NextResponse } from "next/server";

// Fase 3: proyectos activos con sus códigos por delegación (formularios de
// viaje y de gasto). La sesión la exige proxy.ts.
export async function GET() {
  // Fase 5: proyectos y ciudades vienen de Facturas; se refrescan si hace >1 h
  await syncIfStale();
  const projects = await prisma.project.findMany({
    where: { active: true },
    include: { allocations: { where: { active: true }, select: { delegation: true, accountingCode: true } } },
    orderBy: [{ code: "asc" }, { year: "desc" }],
  });
  return NextResponse.json(projects);
}
