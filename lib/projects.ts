// ============================================================================
// Fase 3: proyectos y códigos contables. Lógica PURA (cliente y servidor).
//
// Un proyecto (código + año) tiene un código contable por delegación:
// 006-MAD-2027. El código de un gasto se busca con las "claves" de su ciudad:
// primero el código propio (PML, IBZ…) y luego su delegación (BLR). Así el
// proyecto General, que tiene PML/IBZ, los usa; el resto cae en BLR.
// ============================================================================

export type ProjectAllocation = { delegation: string; accountingCode: string };

export type Project = {
  id: string;
  code: number;
  year: number;
  shortName: string;
  funder?: string | null;
  fullName?: string | null;
  type?: string | null;
  status?: string | null;
  active: boolean;
  allocations: ProjectAllocation[];
};

/** Delegaciones elegibles a mano (gastos de oficina, ciudad "Otro"). */
export const DELEGATIONS = [
  { code: "MAD", name: "Madrid" },
  { code: "BCN", name: "Barcelona" },
  { code: "SVQ", name: "Sevilla" },
  { code: "MLG", name: "Málaga" },
  { code: "CDZ", name: "Cádiz" },
  { code: "VLC", name: "Valencia" },
  { code: "BLR", name: "Baleares" },
  { code: "ZGZ", name: "Zaragoza" },
  { code: "TNRF", name: "Tenerife" },
  { code: "GC", name: "Gran Canaria" },
] as const;

export const GENERAL_CODE = 27;

export function projectLabel(p: Pick<Project, "code" | "shortName" | "year">): string {
  return `${String(p.code).padStart(3, "0")} · ${p.shortName} (${p.year})`;
}

type CityKeys = { code?: string | null; delegation?: string | null; isOther?: boolean };

/** Claves de búsqueda de una ciudad, en orden de preferencia. */
export function cityKeys(city: CityKeys | null | undefined, stageDelegation?: string | null): string[] {
  if (city?.isOther) return stageDelegation ? [stageDelegation] : [];
  return [city?.code, city?.delegation].filter((k): k is string => !!k);
}

export function findAllocation(
  project: Pick<Project, "allocations">,
  keys: string[],
): ProjectAllocation | null {
  for (const k of keys) {
    const a = project.allocations.find((x) => x.delegation === k);
    if (a) return a;
  }
  return null;
}

/**
 * Proyectos que se pueden elegir para un viaje: los que tienen código en
 * ALGUNA de sus ciudades. General primero, luego por código.
 */
export function projectsForKeys<T extends Pick<Project, "allocations" | "code">>(
  projects: T[],
  keysPerCity: string[][],
): T[] {
  return projects
    .filter((p) => keysPerCity.some((keys) => findAllocation(p, keys)))
    .sort((a, b) => (a.code === GENERAL_CODE ? -1 : b.code === GENERAL_CODE ? 1 : a.code - b.code));
}
