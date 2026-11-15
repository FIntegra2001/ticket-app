import { auth } from "@/lib/auth";
import { getSyncState, syncMaestros } from "@/lib/maestros-sync.server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.role === "ADMIN";
}

// Fase 5: estado de la última sincronización con Facturas. Solo ADMIN.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json((await getSyncState()) ?? {});
}

// Botón "Sincronizar con Facturas" de Ajustes. Solo ADMIN.
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, result: await syncMaestros() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al sincronizar";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
