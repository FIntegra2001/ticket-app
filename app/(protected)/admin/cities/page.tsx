"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MaestrosSyncPanel } from "@/components/admin/MaestrosSyncPanel";
import { useCities } from "@/hooks/useCities";

// Ciudades: solo lectura. El catálogo maestro está en Facturas Integra (Fase 5).
export default function AdminCitiesPage() {
  const { data: cities = [], isLoading } = useCities(true);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ciudades</h1>
      <MaestrosSyncPanel />

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {cities.map((c) => (
            <div key={c.id} className="bg-white border rounded-lg p-3 flex items-center gap-3 flex-wrap">
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.region ?? ""}</span>
              {c.code && (
                <code className="text-xs bg-muted rounded px-1.5 py-0.5">
                  {c.code}
                  {c.delegation && c.delegation !== c.code ? ` → ${c.delegation}` : ""}
                </code>
              )}
              {!c.active && <Badge variant="outline">Desactivada</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
