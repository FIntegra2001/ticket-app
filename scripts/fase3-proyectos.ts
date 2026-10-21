// ============================================================================
// Fase 3 — Catálogo de proyectos, códigos de ciudad y proyecto por gasto.
//
//   Simulación (no escribe, genera informe):
//     npx tsx scripts/fase3-proyectos.ts "<ruta>/Proyectos_Maestro_v2_Oct2026.xlsx"
//   Aplicar:
//     npx tsx scripts/fase3-proyectos.ts "<ruta>.xlsx" --apply
//
// 1. Ciudades: código propio y delegación (Mallorca PML/BLR, Ibiza IBZ/BLR,
//    Gran Canaria GC, Tenerife TNRF…). Añade Cádiz.
// 2. Proyectos de la hoja "Proyectos maestro" (+ COFARES y MULTIEMPRESA), con
//    un código contable CÓD-DELEG-AÑO por delegación. NAC = todas.
//    General (027): PML e IBZ en lugar de BLR, y GC. Endesa (011): + GC.
// 3. Viajes antiguos: el texto libre de "proyecto" pasa al catálogo y cada
//    gasto recibe su código contable según la ciudad de su tramo.
// Idempotente: se puede repetir.
// ============================================================================

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const XLSX = args.find((a) => a.endsWith(".xlsx"));
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ALL = ["MAD", "BCN", "SVQ", "CDZ", "MLG", "VLC", "BLR", "ZGZ", "TNRF"];

// nombre en la app → [código propio, delegación]
const CITY_CODES: Record<string, [string, string]> = {
  Madrid: ["MAD", "MAD"],
  Barcelona: ["BCN", "BCN"],
  Sevilla: ["SVQ", "SVQ"],
  Málaga: ["MLG", "MLG"],
  Cádiz: ["CDZ", "CDZ"],
  Valencia: ["VLC", "VLC"],
  Zaragoza: ["ZGZ", "ZGZ"],
  Mallorca: ["PML", "BLR"],
  Ibiza: ["IBZ", "BLR"],
  "Tenerife Norte": ["TNRF", "TNRF"],
  "Tenerife Sur": ["TNRF", "TNRF"],
  "Gran Canaria Norte": ["GC", "GC"],
  "Gran Canaria Sur": ["GC", "GC"],
};

const EXTRA_PROJECTS = [
  { code: 3, shortName: "COFARES", year: 2026, delegations: ["VLC"] },
  { code: 19, shortName: "MULTIEMPRESA", year: 2026, delegations: ["MAD"] },
];

// Texto libre antiguo → código de proyecto (+ delegación forzada)
function legacyProject(text: string): { code: number; delegation?: string } | null {
  const t = text.trim().toLowerCase();
  // Decisión de Gabriel (21/10/2026): los viajes sin proyecto son General
  if (!t) return { code: 27 };
  if (t === "ibiza general") return { code: 27, delegation: "IBZ" };
  if (t === "valencia") return { code: 27, delegation: "VLC" };
  if (t.includes("general")) return { code: 27 };
  if (t.includes("endesa")) return { code: 11 };
  if (t.includes("cofares")) return { code: 3 };
  return null;
}

const cell = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  return String(v);
};
const acc = (code: number, deleg: string, year: number) =>
  `${String(code).padStart(3, "0")}-${deleg}-${year}`;

async function main() {
  if (!XLSX || !fs.existsSync(XLSX)) throw new Error("Indica la ruta del Excel de proyectos");
  console.log(APPLY ? "== MODO APLICAR ==" : "== MODO SIMULACIÓN (no se escribe nada) ==");
  const L: string[] = [`# Informe Fase 3 — Proyectos`, ``, `Modo: **${APPLY ? "APLICADO" : "SIMULACIÓN"}** · ${new Date().toISOString()}`, ``];

  // ------------------------------------------------------ 1. CIUDADES ----
  const cities = await prisma.city.findMany();
  L.push(`## Ciudades`, ``, `| Ciudad | Código | Delegación |`, `|---|---|---|`);
  for (const [name, [code, delegation]] of Object.entries(CITY_CODES)) {
    const exists = cities.find((c) => c.name === name);
    L.push(`| ${name}${exists ? "" : " (nueva)"} | ${code} | ${delegation} |`);
    if (!APPLY) continue;
    if (exists) await prisma.city.update({ where: { id: exists.id }, data: { code, delegation } });
    else
      await prisma.city.create({
        data: { name, code, delegation, region: name === "Cádiz" ? "Andalucía" : null, sortOrder: 6 },
      });
  }

  // ----------------------------------------------------- 2. PROYECTOS ----
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet("Proyectos maestro");
  if (!ws) throw new Error('No encuentro la hoja "Proyectos maestro"');

  type P = { code: number; shortName: string; funder?: string; fullName?: string; type?: string; status?: string; year: number; delegations: string[] };
  const projects: P[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values as ExcelJS.CellValue[];
    const code = Number(cell(v[1]));
    if (!code) return;
    let delegations = cell(v[8]).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (delegations.includes("NAC")) delegations = [...new Set([...delegations.filter((d) => d !== "NAC"), ...ALL])];
    if (code === 27) delegations = [...new Set([...ALL.filter((d) => d !== "BLR"), "PML", "IBZ", "GC"])];
    if (code === 11 && !delegations.includes("GC")) delegations.push("GC");
    projects.push({
      code,
      shortName: cell(v[2]).trim(),
      funder: cell(v[3]).trim() || undefined,
      fullName: cell(v[4]).trim() || undefined,
      type: cell(v[5]).trim() || undefined,
      status: cell(v[6]).trim() || undefined,
      year: Number(cell(v[7])),
      delegations,
    });
  });
  for (const e of EXTRA_PROJECTS) if (!projects.some((p) => p.code === e.code && p.year === e.year)) projects.push({ ...e, status: "Activo", type: "Proyecto" });

  const totalCodes = projects.reduce((a, p) => a + p.delegations.length, 0);
  L.push(``, `## Proyectos`, ``, `${projects.length} proyectos, ${totalCodes} códigos contables.`, ``);
  L.push(`| Cód | Nombre corto | Año | Estado | Delegaciones |`, `|---|---|---|---|---|`);
  projects.sort((a, b) => a.code - b.code).forEach((p) =>
    L.push(`| ${String(p.code).padStart(3, "0")} | ${p.shortName} | ${p.year} | ${p.status ?? ""} | ${p.delegations.join(", ")} |`),
  );

  if (APPLY) {
    for (const p of projects) {
      const { delegations, ...data } = p;
      const saved = await prisma.project.upsert({
        where: { code_year: { code: p.code, year: p.year } },
        create: data,
        update: data,
      });
      for (const d of delegations) {
        await prisma.projectAllocation.upsert({
          where: { projectId_delegation: { projectId: saved.id, delegation: d } },
          create: { projectId: saved.id, delegation: d, accountingCode: acc(p.code, d, p.year) },
          update: { accountingCode: acc(p.code, d, p.year) },
        });
      }
    }
  }

  // -------------------------------------- 2b. TRAMOS "Otros" = IBIZA ----
  // Decisión de Gabriel: el texto libre "Otros" de los viajes antiguos era Ibiza.
  const ibiza = (await prisma.city.findMany()).find((c) => c.name === "Ibiza");
  const otrosStages = await prisma.tripStage.findMany({
    where: { cityOther: { equals: "Otros", mode: "insensitive" } },
    include: { trip: { include: { stages: { include: { city: true }, orderBy: { position: "asc" } } } } },
  });
  L.push(``, `## Tramos "Otros" → Ibiza`, ``, `${otrosStages.length} tramos (${[...new Set(otrosStages.map((s) => s.trip.numberInvoice ?? s.trip.city))].join(", ")})`);
  if (APPLY && ibiza) {
    for (const st of otrosStages) {
      await prisma.tripStage.update({ where: { id: st.id }, data: { cityId: ibiza.id, cityOther: null, delegation: null } });
      const names = st.trip.stages.map((x) => (x.id === st.id ? "Ibiza" : x.city.isOther ? x.cityOther ?? "Otro" : x.city.name));
      await prisma.trip.update({ where: { id: st.tripId }, data: { city: names.join(" + "), region: "Baleares" } });
    }
  }

  // ---------------------------------------------- 3. VIAJES ANTIGUOS ----
  const dbProjects = APPLY
    ? await prisma.project.findMany({ include: { allocations: true } })
    : projects.map((p) => ({
        id: `sim-${p.code}`, code: p.code, year: p.year, shortName: p.shortName,
        allocations: p.delegations.map((d) => ({ delegation: d, accountingCode: acc(p.code, d, p.year) })),
      }));
  const allCities = APPLY ? await prisma.city.findMany() : cities.map((c) => ({ ...c, code: CITY_CODES[c.name]?.[0] ?? null, delegation: CITY_CODES[c.name]?.[1] ?? null }));

  const trips = await prisma.trip.findMany({
    where: { projects: { none: {} } },
    include: { stages: true, expenses: { select: { id: true, stageId: true } } },
  });

  const unmapped: string[] = [];
  const noCode: string[] = [];
  let mappedTrips = 0, mappedExpenses = 0;
  const summary = new Map<string, number>();

  for (const t of trips) {
    const leg = legacyProject(t.project ?? "");
    if (!leg) {
      unmapped.push(`- ${t.numberInvoice ?? "(sin nº)"} ${t.city} ${t.startDate.toISOString().slice(0, 10)} — proyecto: "${t.project ?? ""}"`);
      continue;
    }
    const proj = dbProjects.filter((p) => p.code === leg.code).sort((a, b) => a.year - b.year)[0];
    if (!proj) { unmapped.push(`- ${t.city}: proyecto ${leg.code} no existe`); continue; }
    mappedTrips++;
    summary.set(`${String(proj.code).padStart(3, "0")} ${proj.shortName}`, (summary.get(`${String(proj.code).padStart(3, "0")} ${proj.shortName}`) ?? 0) + 1);

    const codeFor = (stageId: string | null) => {
      const stage = t.stages.find((s) => s.id === stageId) ?? t.stages[0];
      const city = allCities.find((c) => c.id === stage?.cityId);
      // "Tenerife" antiguo (texto libre) → TNRF
      const other = stage?.cityOther?.toLowerCase() ?? "";
      const keys = leg.delegation
        ? [leg.delegation]
        : [city?.code, city?.delegation, other.includes("tenerife") ? "TNRF" : null].filter(Boolean) as string[];
      for (const k of keys) {
        const a = proj.allocations.find((x) => x.delegation === k);
        if (a) return a;
      }
      return null;
    };

    const updates: { id: string; delegation: string | null; accountingCode: string | null }[] = [];
    for (const e of t.expenses) {
      const a = codeFor(e.stageId);
      if (!a) noCode.push(`- ${t.numberInvoice ?? "(sin nº)"} ${t.city}: gasto sin delegación clara`);
      updates.push({ id: e.id, delegation: a?.delegation ?? null, accountingCode: a?.accountingCode ?? null });
      mappedExpenses++;
    }

    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        await tx.tripProject.create({ data: { tripId: t.id, projectId: proj.id } });
        await tx.trip.update({ where: { id: t.id }, data: { project: proj.shortName } });
        for (const u of updates)
          await tx.expense.update({ where: { id: u.id }, data: { projectId: proj.id, delegation: u.delegation, accountingCode: u.accountingCode } });
        for (const s of t.stages)
          if (s.cityOther?.toLowerCase().includes("tenerife") && !s.delegation)
            await tx.tripStage.update({ where: { id: s.id }, data: { delegation: "TNRF" } });
      });
    }
  }

  L.push(``, `## Viajes existentes`, ``, `- Viajes sin proyecto del catálogo: **${trips.length}**`, `- Se asignan: **${mappedTrips}** viajes, **${mappedExpenses}** gastos`);
  summary.forEach((n, k) => L.push(`  - ${k}: ${n} viajes`));
  L.push(``, `### Sin asignar (decidir a mano)`, ``, unmapped.length ? unmapped.join("\n") : "Ninguno.");
  L.push(``, `### Gastos sin código contable (ciudad "Otro" sin delegación)`, ``, noCode.length ? [...new Set(noCode)].join("\n") : "Ninguno.");

  // ------------------------- 4. GASTOS CON PROYECTO PERO SIN CÓDIGO ----
  // (p. ej. los de tramos "Otros" que ahora son Ibiza): se recalcula el código.
  const missing = await prisma.expense.findMany({
    where: { projectId: { not: null }, accountingCode: null, tripId: { not: null } },
    include: { project: { include: { allocations: true } }, stage: { include: { city: true } } },
  });
  let fixed = 0;
  for (const e of missing) {
    const keys = [e.stage?.city.code, e.stage?.city.delegation, e.stage?.delegation].filter(Boolean) as string[];
    const a = keys.map((k) => e.project!.allocations.find((x) => x.delegation === k)).find(Boolean);
    if (!a) continue;
    fixed++;
    if (APPLY) await prisma.expense.update({ where: { id: e.id }, data: { delegation: a.delegation, accountingCode: a.accountingCode } });
  }
  L.push(``, `## Gastos con proyecto sin código contable`, ``, `${missing.length} encontrados, ${fixed} se completan.`);

  const outDir = path.join(process.cwd(), "scripts", "out");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `fase3-proyectos-${APPLY ? "aplicado" : "simulacion"}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
  fs.writeFileSync(file, L.join("\n"), "utf8");
  console.log(`Informe: ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
