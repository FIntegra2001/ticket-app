"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCities } from "@/hooks/useCities";

// Fase 1: catálogo de ciudades con su comunidad autónoma. Solo ADMIN.
export default function AdminCitiesPage() {
  const queryClient = useQueryClient();
  const { data: cities = [], isLoading } = useCities(true);
  const [name, setName] = React.useState("");
  const [region, setRegion] = React.useState("");

  const regions = [...new Set(cities.map((c) => c.region).filter(Boolean))] as string[];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["cities"] });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, region }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
    },
    onSuccess: () => {
      toast.success("Ciudad añadida");
      setName("");
      setRegion("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/cities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ciudades</h1>

      <form
        className="bg-white border rounded-lg p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-semibold">Añadir ciudad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="name">Ciudad</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="region">Comunidad autónoma</Label>
            <Input
              id="region"
              list="regions"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <datalist id="regions">
              {regions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>
        <Button type="submit" disabled={!name.trim() || !region.trim() || create.isPending}>
          Añadir
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {cities.map((c) => (
            <div
              key={c.id}
              className="bg-white border rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div>
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-sm text-muted-foreground">{c.region ?? ""}</span>
                {!c.active && (
                  <Badge variant="outline" className="ml-2">
                    Desactivada
                  </Badge>
                )}
              </div>
              {!c.isOther && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                >
                  {c.active ? "Desactivar" : "Activar"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
