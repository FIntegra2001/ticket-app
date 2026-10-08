// ============================================================================
// Fase 1 — Migración de viajes a itinerarios por tramos.
//
//   Simulación (NO escribe nada, solo genera el informe):
//     npx tsx scripts/fase1-migracion.ts
//   Aplicar (solo tras revisar y validar el informe):
//     npx tsx scripts/fase1-migracion.ts --apply
//
// Lee DATABASE_URL del fichero .env. Usar primero contra la rama de pruebas
// de Neon.
//
// Qué hace:
//  1. Crea el catálogo de ciudades (las 12 + "Otro (especificar)") si falta.
//  2. Viajes con el MISMO nº de liquidación → se fusionan en un único viaje con
//     un tramo por cada viaje original (ordenados por fecha). Gastos,
//     documentos y personas asignadas pasan al viaje resultante; cada gasto
//     queda en el tramo del viaje del que venía. Ningún importe cambia.
//     Los grupos con estados distintos o de comunidades distintas NO se
//     fusionan: salen en el informe para que se decida a mano.
//  3. El resto de viajes → un único tramo con su ciudad y fechas.
//  4. Viajes cuya ciudad no está en el catálogo (p. ej. "Tenerife", "Cádiz")
//     → tramo "Otro (especificar)" con el nombre original, y aviso.
//
// Es idempotente: los viajes que ya tienen tramos se ignoran.
// Antes de fusionar, guarda una copia JSON de los viajes que desaparecen.
// ============================================================================

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATALOG: { name: string; region: string | null; isOther?: boolean }[] = [
  { name: "Barcelona", region: "Cataluña" },
  { name: "Valencia", region: "C. Valenciana" },
  { name: "Madrid", region: "C. Madrid" },
  { name: "Sevilla", region: "Andalucía" },
  { name: "Málaga", region: "Andalucía" },
  { name: "Mallorca", region: "Baleares" },
  { name: "Ibiza", region: "Baleares" },
  { name: "Gran Canaria Sur", region: "Canarias" },
  { name: "Gran Canaria Norte", region: "Canarias" },
  { name: "Tenerife Norte", region: "Canarias" },
  { name: "Tenerife Sur", region: "Canarias" },
  { name: "Zaragoza", region: "Aragón" },
  { name: "Otro (especificar)", region: null, isOther: true },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const eur = (n: number) => `${n.toFixed(2)} €`;

type CityRef = { id: string; name: string; region: string | null; isOther: boolean };

async function main() {
  console.log(APPLY ? "== MODO APLICAR ==" : "== MODO SIMULACIÓN (no se escribe nada) ==");

  // ---------------------------------------------------------------- 1 ----
  const existingCities = await prisma.city.findMany();
  const missing = CATALOG.filter((c) => !existingCities.some((e) => norm(e.name) === norm(c.name)));
  let cities: CityRef[] = existingCities;
  if (APPLY && missing.length > 0) {
    for (const [i, c] of CATALOG.entries()) {
      if (!missing.includes(c)) continue;
      await prisma.city.create({
        data: { name: c.name, region: c.region, isOther: !!c.isOther, sortOrder: i + 1 },
      });
    }
    cities = await prisma.city.findMany();
  } else if (!APPLY) {
    // En simulación, ids ficticios para poder calcular el mapeo
    cities = [
      ...existingCities,
      ...missing.map((c) => ({ id: `nuevo:${c.name}`, name: c.name, region: c.region, isOther: !!c.isOther })),
    ];
  }
  const other = cities.find((c) => c.isOther)!;
  const mapCity = (name: string): { city: CityRef; cityOther: string | null; exact: boolean } => {
    const match = cities.find((c) => !c.isOther && norm(c.name) === norm(name));
    return match
      ? { city: match, cityOther: null, exact: true }
      : { city: other, cityOther: name, exact: false };
  };

  // ---------------------------------------------------------------- 2 ----
  const trips = await prisma.trip.findMany({
    where: { stages: { none: {} } },
    include: {
      expenses: { select: { id: true, amount: true } },
      assignedUsers: { include: { user: { select: { name: true, email: true } } } },
      documents: { select: { id: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const groups = new Map<string, typeof trips>();
  for (const t of trips) {
    const key = t.numberInvoice?.trim();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const mergeGroups = [...groups.entries()].filter(([, g]) => g.length > 1);

  const toMerge: [string, typeof trips][] = [];
  const toReview: { invoice: string; reason: string; trips: typeof trips }[] = [];
  for (const [invoice, g] of mergeGroups) {
    const statuses = new Set(g.map((t) => t.status));
    const regions = new Set(
      g.map((t) => mapCity(t.city).city).filter((c) => !c.isOther).map((c) => c.region),
    );
    if (statuses.size > 1) {
      toReview.push({ invoice, reason: `estados distintos (${[...statuses].join(", ")})`, trips: g });
    } else if (regions.size > 1) {
      toReview.push({ invoice, reason: `comunidades distintas (${[...regions].join(", ")})`, trips: g });
    } else {
      toMerge.push([invoice, g]);
    }
  }
  const mergedIds = new Set(toMerge.flatMap(([, g]) => g.map((t) => t.id)));
  const singles = trips.filter((t) => !mergedIds.has(t.id));
  const unmapped = trips.filter((t) => !mapCity(t.city).exact);

  // ---------------------------------------------------------- INFORME ----
  const L: string[] = [];
  L.push(`# Informe de migración — Fase 1 (viajes combinados)`);
  L.push(``, `Generado: ${new Date().toISOString()} · Modo: **${APPLY ? "APLICADO" : "SIMULACIÓN"}**`, ``);
  L.push(`## Resumen`, ``);
  L.push(`- Viajes sin itinerario: **${trips.length}**`);
  L.push(`- Ciudades a crear en el catálogo: **${missing.length}** ${missing.map((c) => c.name).join(", ")}`);
  L.push(`- Grupos que se fusionan (mismo nº de liquidación): **${toMerge.length}** (${toMerge.reduce((a, [, g]) => a + g.length, 0)} viajes → ${toMerge.length})`);
  L.push(`- Grupos con mismo nº de liquidación que **NO** se fusionan (revisar a mano): **${toReview.length}**`);
  L.push(`- Viajes que pasan a 1 tramo: **${singles.length}**`);
  L.push(`- Viajes con ciudad fuera del catálogo (pasan a "Otro"): **${unmapped.length}**`);
  L.push(`- Nº de viajes en indicadores: antes **${trips.length}**, después **${trips.length - toMerge.reduce((a, [, g]) => a + g.length - 1, 0)}**`);

  const tripLine = (t: (typeof trips)[number]) => {
    const total = t.expenses.reduce((a, e) => a + Number(e.amount), 0);
    const users = t.assignedUsers.map((a) => a.user.name ?? a.user.email).join(", ");
    return `| ${t.city} | ${fmt(t.startDate)} → ${fmt(t.endDate)} | ${t.status} | ${users} | ${t.expenses.length} | ${eur(total)} | ${eur(Number(t.totalAmount))} |`;
  };
  const header = `| Destino | Fechas | Estado | Personas | Nº gastos | Suma gastos | Total guardado |\n|---|---|---|---|---|---|---|`;

  L.push(``, `## Fusiones propuestas`, ``);
  if (toMerge.length === 0) L.push(`Ninguna.`);
  for (const [invoice, g] of toMerge) {
    const total = g.reduce((a, t) => a + t.expenses.reduce((b, e) => b + Number(e.amount), 0), 0);
    L.push(`### Liquidación ${invoice} — ${g.length} viajes → 1 viaje de ${g.length} destinos (total ${eur(total)})`, ``, header);
    g.forEach((t) => L.push(tripLine(t)));
    const overlaps = g.slice(1).filter((t, i) => t.startDate < g[i].endDate);
    if (overlaps.length) L.push(``, `⚠️ Fechas solapadas entre destinos: revisar el itinerario después de migrar.`);
    L.push(``);
  }

  L.push(``, `## Mismo nº de liquidación pero NO se fusionan (decidir a mano)`, ``);
  if (toReview.length === 0) L.push(`Ninguno.`);
  for (const r of toReview) {
    L.push(`### Liquidación ${r.invoice} — motivo: ${r.reason}`, ``, header);
    r.trips.forEach((t) => L.push(tripLine(t)));
    L.push(``);
  }

  L.push(``, `## Ciudades fuera del catálogo`, ``);
  if (unmapped.length === 0) L.push(`Ninguna.`);
  else {
    L.push(`Pasan a "Otro (especificar)" conservando el nombre original. Se pueden corregir editando el viaje.`, ``);
    L.push(`| Ciudad original | Nº de viajes |`, `|---|---|`);
    const counts = new Map<string, number>();
    unmapped.forEach((t) => counts.set(t.city, (counts.get(t.city) ?? 0) + 1));
    counts.forEach((n, c) => L.push(`| ${c} | ${n} |`));
  }

  // Descuadres del total guardado (informativo, la migración no los toca)
  const drift = trips.filter(
    (t) => Math.abs(t.expenses.reduce((a, e) => a + Number(e.amount), 0) - Number(t.totalAmount)) > 0.005,
  );
  L.push(``, `## Totales descuadrados (informativo)`, ``);
  L.push(drift.length === 0 ? `Ninguno.` : `${drift.length} viaje(s) cuyo total guardado no coincide con la suma de sus gastos:`);
  drift.forEach((t) =>
    L.push(`- ${t.numberInvoice ?? "(sin nº)"} ${t.city} ${fmt(t.startDate)}: guardado ${eur(Number(t.totalAmount))}, suma real ${eur(t.expenses.reduce((a, e) => a + Number(e.amount), 0))}`),
  );

  const outDir = path.join(process.cwd(), "scripts", "out");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outDir, `fase1-informe-${APPLY ? "aplicado" : "simulacion"}-${stamp}.md`);
  fs.writeFileSync(reportPath, L.join("\n"), "utf8");
  console.log(`Informe: ${reportPath}`);

  if (!APPLY) {
    console.log("Simulación terminada. Revisa el informe; para aplicar: --apply");
    return;
  }

  // ----------------------------------------------------------- APLICAR ----
  // Copia de seguridad de los viajes que desaparecen al fusionar
  const backupIds = toMerge.flatMap(([, g]) => g.slice(1).map((t) => t.id));
  const backup = await prisma.trip.findMany({
    where: { id: { in: backupIds } },
    include: { expenses: true, assignedUsers: true, documents: true },
  });
  fs.writeFileSync(path.join(outDir, `fase1-backup-${stamp}.json`), JSON.stringify(backup, null, 2), "utf8");

  const expenseCountBefore = await prisma.expense.count();
  const sumBefore = (await prisma.expense.aggregate({ _sum: { amount: true } }))._sum.amount;

  for (const t of singles) {
    const { city, cityOther } = mapCity(t.city);
    await prisma.$transaction(async (tx) => {
      const stage = await tx.tripStage.create({
        data: { tripId: t.id, position: 1, cityId: city.id, cityOther, arrivalDate: t.startDate, departureDate: t.endDate },
      });
      await tx.expense.updateMany({ where: { tripId: t.id }, data: { stageId: stage.id } });
      await tx.trip.update({ where: { id: t.id }, data: { region: city.region } });
    });
  }

  for (const [, g] of toMerge) {
    const [master, ...rest] = g; // ya vienen ordenados por fecha de inicio
    await prisma.$transaction(async (tx) => {
      const names: string[] = [];
      let region: string | null = null;
      for (const [i, t] of g.entries()) {
        const { city, cityOther } = mapCity(t.city);
        names.push(cityOther ?? city.name);
        region ??= city.region;
        const stage = await tx.tripStage.create({
          data: { tripId: master.id, position: i + 1, cityId: city.id, cityOther, arrivalDate: t.startDate, departureDate: t.endDate },
        });
        await tx.expense.updateMany({ where: { tripId: t.id }, data: { tripId: master.id, stageId: stage.id } });
        await tx.tripDocument.updateMany({ where: { tripId: t.id }, data: { tripId: master.id } });
      }
      const userIds = [...new Set(g.flatMap((t) => t.assignedUsers.map((a) => a.userId)))];
      await tx.tripAssignment.createMany({
        data: userIds.map((userId) => ({ tripId: master.id, userId })),
        skipDuplicates: true,
      });
      const notes = g.map((t) => t.notes).filter(Boolean).join("\n");
      await tx.trip.update({
        where: { id: master.id },
        data: {
          city: names.join(" + "),
          startDate: g[0].startDate,
          endDate: g.reduce((d, t) => (t.endDate > d ? t.endDate : d), g[0].endDate),
          region,
          notes: notes || null,
          totalAmount: g.reduce((a, t) => a + Number(t.totalAmount), 0),
        },
      });
      // Los viajes absorbidos ya no tienen gastos ni documentos: se eliminan
      await tx.trip.deleteMany({ where: { id: { in: rest.map((t) => t.id) } } });
    });
  }

  // Comprobación final: ni un gasto perdido ni un céntimo cambiado
  const expenseCountAfter = await prisma.expense.count();
  const sumAfter = (await prisma.expense.aggregate({ _sum: { amount: true } }))._sum.amount;
  console.log(`Gastos: ${expenseCountBefore} → ${expenseCountAfter}. Suma: ${sumBefore} → ${sumAfter}`);
  if (expenseCountBefore !== expenseCountAfter || String(sumBefore) !== String(sumAfter)) {
    console.error("⚠️ DESCUADRE: revisar inmediatamente (hay copia en scripts/out)");
    process.exitCode = 1;
  } else {
    console.log("OK: ningún gasto perdido ni modificado.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
