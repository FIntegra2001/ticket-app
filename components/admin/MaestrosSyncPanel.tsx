"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncState = { lastSyncAt?: string | null; lastError?: string | null };

/**
 * Fase 5: proyectos y ciudades se gestionan en Facturas Integra. Este panel
 * avisa de ello, muestra la última sincronización y permite lanzarla a mano.
 */
export function MaestrosSyncPanel() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery<SyncState>({
    queryKey: ["maestros-sync"],
    queryFn: async () => (await fetch("/api/admin/maestros")).json(),
  });
  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/maestros", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al sincronizar");
      return body.result as { projects: number; cities: number };
    },
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.projects} proyectos y ${r.cities} ciudades`);
      ["maestros-sync", "admin-projects", "projects", "cities"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ["maestros-sync"] });
    },
  });

  const last = state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString("es-ES") : null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
      <p className="text-sm">
        Se gestionan en <strong>Facturas Integra → Configuración → Datos maestros</strong>. Aquí
        solo se consultan; la app los copia de Facturas automáticamente.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
          <RefreshCw className={`w-4 h-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
          Sincronizar con Facturas
        </Button>
        <span className="text-xs text-muted-foreground">
          {last ? `Última sincronización: ${last}` : "Aún no se ha sincronizado"}
        </span>
      </div>
      {state?.lastError && (
        <p className="text-xs text-amber-700">
          El último intento falló ({state.lastError}). Se sigue usando lo último sincronizado.
        </p>
      )}
    </div>
  );
}
