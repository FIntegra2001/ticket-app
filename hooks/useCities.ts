"use client";

import { useQuery } from "@tanstack/react-query";
import type { City } from "@/types";

/** Catálogo de ciudades. `all` (solo ADMIN) incluye las desactivadas. */
export function useCities(all = false) {
  return useQuery<City[]>({
    queryKey: ["cities", all],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/cities${all ? "?all=1" : ""}`);
      if (!res.ok) throw new Error("Error al cargar ciudades");
      return res.json();
    },
  });
}
