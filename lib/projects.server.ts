// Parte SERVIDOR de proyectos (toca la BD). No importar desde componentes cliente.
import prisma from "@/lib/db";
import { cityKeys, findAllocation, projectsForKeys } from "@/lib/projects";

export class ProjectError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const withAllocations = { allocations: { select: { delegation: true, accountingCode: true } } };

/**
 * Valida los proyectos de un viaje contra sus ciudades y devuelve el texto
 * resumen para Trip.project ("GENERAL + F. ENDESA").
 */
export async function prepareTripProjects(
  projectIds: string[],
  stages: { cityId: string; delegation?: string | null }[],
): Promise<string> {
  const [projects, cities] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds }, active: true }, include: withAllocations }),
    prisma.city.findMany({ where: { id: { in: stages.map((s) => s.cityId) } } }),
  ]);
  if (projects.length !== new Set(projectIds).size) {
    throw new ProjectError("Algún proyecto elegido no existe o está desactivado");
  }
  const keys = stages.map((s) => cityKeys(cities.find((c) => c.id === s.cityId), s.delegation));
  const eligible = new Set(projectsForKeys(projects, keys).map((p) => p.id));
  const bad = projects.filter((p) => !eligible.has(p.id));
  if (bad.length) {
    throw new ProjectError(
      `${bad.map((p) => p.shortName).join(", ")} no se desarrolla en los destinos de este viaje`,
    );
  }
  return projectIds.map((id) => projects.find((p) => p.id === id)!.shortName).join(" + ");
}

/** Para un trip.create / update: sustituye los proyectos del viaje. */
export function tripProjectsInput(projectIds: string[]) {
  return { deleteMany: {}, create: projectIds.map((projectId) => ({ projectId })) };
}

type Resolved = { projectId: string | null; delegation: string | null; accountingCode: string | null };

/**
 * Proyecto y código contable de un gasto de VIAJE. Si el viaje tiene un solo
 * proyecto se usa ese; si tiene varios, hay que elegir. La delegación sale de
 * la ciudad del tramo del gasto.
 */
export async function resolveTripExpenseProject(
  tripId: string,
  stageId: string | null,
  projectId?: string | null,
): Promise<Resolved> {
  const tripProjects = await prisma.tripProject.findMany({
    where: { tripId },
    include: { project: { include: withAllocations } },
  });
  if (tripProjects.length === 0) return { projectId: null, delegation: null, accountingCode: null };

  const chosen = projectId
    ? tripProjects.find((tp) => tp.projectId === projectId)
    : tripProjects.length === 1
      ? tripProjects[0]
      : null;
  if (!chosen) {
    throw new ProjectError(
      projectId ? "El proyecto elegido no es de este viaje" : "Elige a qué proyecto va este gasto",
    );
  }

  const stage = stageId
    ? await prisma.tripStage.findUnique({ where: { id: stageId }, include: { city: true } })
    : await prisma.tripStage.findFirst({ where: { tripId }, orderBy: { position: "asc" }, include: { city: true } });
  const alloc = findAllocation(chosen.project, cityKeys(stage?.city, stage?.delegation));
  return {
    projectId: chosen.projectId,
    delegation: alloc?.delegation ?? null,
    accountingCode: alloc?.accountingCode ?? null,
  };
}

/** Proyecto y código contable de un gasto de OFICINA (delegación elegida). */
export async function resolveOfficeExpenseProject(
  projectId?: string | null,
  delegation?: string | null,
): Promise<Resolved> {
  if (!projectId) throw new ProjectError("Elige el proyecto del gasto");
  if (!delegation) throw new ProjectError("Elige la delegación del gasto");
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: withAllocations });
  if (!project) throw new ProjectError("Proyecto no encontrado");
  const alloc = findAllocation(project, [delegation]);
  if (!alloc) throw new ProjectError(`${project.shortName} no tiene código para la delegación ${delegation}`);
  return { projectId, delegation: alloc.delegation, accountingCode: alloc.accountingCode };
}

/** Tramos con los que validar proyectos al editar: los nuevos o los guardados. */
export async function stagesOf(
  tripId: string,
  stages?: { cityId: string; delegation?: string | null }[],
) {
  if (stages) return stages;
  return prisma.tripStage.findMany({ where: { tripId }, select: { cityId: true, delegation: true } });
}
