"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MaestrosSyncPanel } from "@/components/admin/MaestrosSyncPanel";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { projectLabel, type Project } from "@/lib/projects";

type AdminProject = Project & { _count: { expenses: number } };

// Fase 3: catálogo de proyectos con sus códigos contables por delegación.
// Solo ADMIN. La carga inicial viene del Excel Proyectos_Maestro.
export default function AdminProjectsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery<AdminProject[]>({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/projects");
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  const q = search.trim().toLowerCase();
  const shown = projects.filter(
    (p) =>
      !q ||
      projectLabel(p).toLowerCase().includes(q) ||
      (p.funder ?? "").toLowerCase().includes(q) ||
      p.allocations.some((a) => a.delegation.toLowerCase() === q),
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          {projects.filter((p) => p.active).length} activos de {projects.length}. Un proyecto
          que Facturas deja de enviar se desactiva aquí; lo ya imputado no cambia.
        </p>
      </div>
      <MaestrosSyncPanel />
      <Input
        placeholder="Buscar por nombre, código, financiador o delegación (MAD, BLR…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : (
        <div className="space-y-2">
          {shown.map((p) => (
            <div key={p.id} className="bg-white border rounded-lg p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  className="flex-1 text-left"
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{projectLabel(p)}</span>
                    {p.type && <Badge variant="outline">{p.type}</Badge>}
                    {p.status && <Badge variant="secondary">{p.status}</Badge>}
                    {!p.active && <Badge variant="destructive">Desactivado</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.funder} · {p.allocations.map((a) => a.delegation).join(", ")} ·{" "}
                    {p._count.expenses} gastos
                  </p>
                </button>
              </div>
              {open === p.id && (
                <div className="mt-3 border-t pt-2">
                  {p.fullName && <p className="text-sm mb-2">{p.fullName}</p>}
                  <div className="flex flex-wrap gap-2">
                    {p.allocations.map((a) => (
                      <code key={a.delegation} className="text-xs bg-muted rounded px-2 py-1">
                        {a.accountingCode}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
