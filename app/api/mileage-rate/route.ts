import { getRateFor } from "@/lib/mileage.server";
import { NextResponse } from "next/server";

// Tarifa de kilometraje vigente en una fecha (?date=YYYY-MM-DD). La sesión la
// exige proxy.ts. Solo informativa: el importe final lo calcula el servidor.
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  const d = date ? new Date(`${date}T12:00:00Z`) : new Date();
  if (isNaN(d.getTime())) {
    return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  }
  return NextResponse.json({ ratePerKm: await getRateFor(d) });
}
