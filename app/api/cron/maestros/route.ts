import { syncMaestros } from "@/lib/maestros-sync.server";
import { NextResponse } from "next/server";

// Fase 5: sincronización diaria con Facturas (Vercel Cron, ver vercel.json).
// Vercel envía "Authorization: Bearer <CRON_SECRET>". proxy.ts deja pasar
// /api/cron sin sesión: la protección es este secreto.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await syncMaestros() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 502 });
  }
}
