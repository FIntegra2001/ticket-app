"use client";

import { useQuery } from "@tanstack/react-query";
import type { Project } from "@/lib/projects";

/** Fase 3: proyectos activos con sus códigos por delegación. */
export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Error al cargar proyectos");
      return res.json();
    },
  });
}
