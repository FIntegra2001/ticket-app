// ============================================================================
// Fase 5: sincronización de proyectos y ciudades desde Facturas Integra.
//
// Facturas es la app maestra: aquí solo se copia lo que devuelve su endpoint
// de solo lectura (GET /api/public/maestros). Reglas:
//  · Proyectos por (code, year); ciudades por name. Upsert.
//  · Lo que ya no venga → active = false. Nunca se borra (hay viajes y gastos
//    que lo referencian) y no se tocan los Expense.accountingCode guardados.
//  · Si el endpoint falla, se sigue con lo último sincronizado.
// ============================================================================
import prisma from "@/lib/db";

const DEFAULT_URL = "https://facturas-integra.vercel.app/api/public/maestros";
const STATE_ID = "maestros";
export const MAX_AGE_MS = 60 * 60 * 1000; // 1 hora

type MaestrosResponse = {
  generado: string;
  anio: number;
  proyectos: {
    codigoNumero: number;
    nombre: string;
    nombreCompleto?: string | null;
    financiador?: string | null;
    tipo?: string | null;
    estado?: string | null;
    anio: number | null;
    asignaciones: { delegacion: string; codigoContable: string }[];
  }[];
  ciudades: {
    nombre: string;
    delegacion: string | null;
    region: string | null;
    codigo: string | null;
    esOtra: boolean;
  }[];
};

export type SyncResult = {
  projects: number;
  allocations: number;
  cities: number;
  deactivatedProjects: number;
  deactivatedCities: number;
};

async function fetchMaestros(): Promise<MaestrosResponse> {
  const key = process.env.MAESTROS_API_KEY;
  if (!key) throw new Error("Falta MAESTROS_API_KEY en la configuración");
  const res = await fetch(process.env.MAESTROS_API_URL || DEFAULT_URL, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Facturas respondió ${res.status}`);
  const data = (await res.json()) as MaestrosResponse;
  if (!Array.isArray(data.proyectos) || !Array.isArray(data.ciudades)) {
    throw new Error("Respuesta de Facturas con formato inesperado");
  }
  return data;
}

export async function syncMaestros(): Promise<SyncResult> {
  try {
    const data = await fetchMaestros();
    const result: SyncResult = { projects: 0, allocations: 0, cities: 0, deactivatedProjects: 0, deactivatedCities: 0 };

    // ------------------------------------------------------- proyectos ----
    const seenProjects: string[] = [];
    for (const p of data.proyectos) {
      const year = p.anio ?? data.anio; // GENERAL/Interno: año en curso
      const fields = {
        shortName: p.nombre,
        fullName: p.nombreCompleto ?? null,
        funder: p.financiador ?? null,
        type: p.tipo ?? null,
        status: p.estado ?? null,
        active: true,
      };
      const saved = await prisma.project.upsert({
        where: { code_year: { code: p.codigoNumero, year } },
        create: { code: p.codigoNumero, year, ...fields },
        update: fields,
      });
      seenProjects.push(saved.id);
      result.projects++;

      const delegs: string[] = [];
      for (const a of p.asignaciones) {
        await prisma.projectAllocation.upsert({
          where: { projectId_delegation: { projectId: saved.id, delegation: a.delegacion } },
          create: { projectId: saved.id, delegation: a.delegacion, accountingCode: a.codigoContable },
          update: { accountingCode: a.codigoContable, active: true },
        });
        delegs.push(a.delegacion);
        result.allocations++;
      }
      await prisma.projectAllocation.updateMany({
        where: { projectId: saved.id, delegation: { notIn: delegs } },
        data: { active: false },
      });
    }
    result.deactivatedProjects = (
      await prisma.project.updateMany({ where: { id: { notIn: seenProjects }, active: true }, data: { active: false } })
    ).count;

    // --------------------------------------------------------- ciudades ----
    const seenCities: string[] = [];
    for (const c of data.ciudades) {
      const fields = {
        region: c.region,
        delegation: c.delegacion,
        code: c.codigo,
        isOther: c.esOtra,
        active: true,
      };
      await prisma.city.upsert({ where: { name: c.nombre }, create: { name: c.nombre, ...fields }, update: fields });
      seenCities.push(c.nombre);
      result.cities++;
    }
    // "Otro (especificar)" se mantiene aunque Facturas no la envíe
    result.deactivatedCities = (
      await prisma.city.updateMany({
        where: { name: { notIn: seenCities }, isOther: false, active: true },
        data: { active: false },
      })
    ).count;

    await prisma.syncState.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, lastSyncAt: new Date(), lastError: null, lastResult: JSON.stringify(result) },
      update: { lastSyncAt: new Date(), lastError: null, lastResult: JSON.stringify(result) },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.syncState.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, lastError: message },
      update: { lastError: message },
    });
    throw error;
  }
}

export async function getSyncState() {
  return prisma.syncState.findUnique({ where: { id: STATE_ID } });
}

/**
 * Sincroniza si la última vez fue hace más de una hora. Nunca lanza: si
 * Facturas no responde, se sigue con lo último sincronizado.
 */
export async function syncIfStale(): Promise<void> {
  if (!process.env.MAESTROS_API_KEY) return;
  const state = await getSyncState();
  const last = state?.lastSyncAt?.getTime() ?? 0;
  // Tras un error, no reintentar en cada petición: como mucho cada 10 min
  const lastAttempt = state?.updatedAt?.getTime() ?? 0;
  if (Date.now() - last < MAX_AGE_MS) return;
  if (state?.lastError && Date.now() - lastAttempt < 10 * 60 * 1000) return;
  await syncMaestros().catch(() => {});
}
