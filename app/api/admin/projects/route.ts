import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Fase 3: catálogo completo (incluidos desactivados) para Ajustes. Solo ADMIN.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const projects = await prisma.project.findMany({
    include: {
      allocations: { select: { delegation: true, accountingCode: true }, orderBy: { delegation: "asc" } },
      _count: { select: { expenses: true } },
    },
    orderBy: [{ code: "asc" }, { year: "desc" }],
  });
  return NextResponse.json(projects);
}
