// ============================================================================
// Fase 5 — Correcciones puntuales de datos pedidas por Facturas Integra.
//
//   Simulación:  npx tsx scripts/fase5-correcciones.ts --asignar 1501=email --asignar 1515=email
//   Aplicar:     … --apply
//
// 1. Dos gastos con año imposible (2016 y 2028) → mismo día y mes en 2026,
//    que cae dentro de su viaje (liquidaciones 1523 y 1500).
// 2. Liquidaciones asignadas solo a administracion@ → se asigna el viajero
//    real (por email) y se quita administracion@ de ese viaje.
// ============================================================================
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DATE_FIXES = [
  { id: "cmwd8jp94000008lar3fdomul", from: "2016", to: 2026 }, // 1523 Zaragoza, One Cup Bistro
  { id: "cmucnrr7w000004l25km3nxkp", from: "2028", to: 2026 }, // 1500 Zaragoza, Bar La Fama
];
const ADMIN_EMAIL = "administracion@fundacionintegra.org";

const assignments = process.argv
  .flatMap((a, i, all) => (a === "--asignar" ? [all[i + 1]] : []))
  .filter(Boolean)
  .map((s) => {
    const [invoice, email] = s.split("=");
    return { invoice, email: email?.trim().toLowerCase() };
  });

async function main() {
  console.log(APPLY ? "== MODO APLICAR ==" : "== MODO SIMULACIÓN (no se escribe nada) ==");

  for (const f of DATE_FIXES) {
    const e = await prisma.expense.findUnique({ where: { id: f.id }, include: { trip: { select: { numberInvoice: true, startDate: true, endDate: true } } } });
    if (!e) { console.log(`Gasto ${f.id}: no existe`); continue; }
    if (String(e.date.getUTCFullYear()) !== f.from && !(e.date.getUTCMonth() === 11 && String(e.date.getUTCFullYear() + 1) === f.from)) {
      console.log(`Gasto ${f.id}: ya corregido (${e.date.toISOString().slice(0, 10)})`); continue;
    }
    const fixed = new Date(e.date);
    fixed.setUTCFullYear(fixed.getUTCFullYear() + (f.to - Number(f.from)));
    console.log(`Gasto ${e.vendor} (liq. ${e.trip?.numberInvoice}): ${e.date.toISOString().slice(0, 10)} → ${fixed.toISOString().slice(0, 10)} (viaje ${e.trip?.startDate.toISOString().slice(0, 10)} – ${e.trip?.endDate.toISOString().slice(0, 10)})`);
    if (APPLY) await prisma.expense.update({ where: { id: f.id }, data: { date: fixed } });
  }

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  for (const a of assignments) {
    const trip = await prisma.trip.findFirst({ where: { numberInvoice: a.invoice }, include: { assignedUsers: { include: { user: true } } } });
    const user = await prisma.user.findUnique({ where: { email: a.email } });
    if (!trip) { console.log(`Liquidación ${a.invoice}: no existe`); continue; }
    if (!user) { console.log(`Liquidación ${a.invoice}: no hay usuario con email ${a.email}`); continue; }
    console.log(`Liquidación ${a.invoice} (${trip.city}): ${trip.assignedUsers.map((x) => x.user.email).join(", ")} → ${user.name} <${user.email}>`);
    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        await tx.tripAssignment.upsert({
          where: { tripId_userId: { tripId: trip.id, userId: user.id } },
          create: { tripId: trip.id, userId: user.id },
          update: {},
        });
        if (admin && admin.id !== user.id) await tx.tripAssignment.deleteMany({ where: { tripId: trip.id, userId: admin.id } });
      });
    }
  }
  if (!assignments.length) console.log("Sin --asignar: no se reasigna ninguna liquidación.");
}

main().finally(() => prisma.$disconnect());
