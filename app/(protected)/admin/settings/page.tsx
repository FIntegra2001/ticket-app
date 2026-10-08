"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { DEFAULT_RATE_PER_KM } from "@/lib/mileage";

type Rate = { id: string; ratePerKm: number; validFrom: string };

// Fase 2: configuración del administrador (tarifa de kilometraje + enlaces).
export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [rate, setRate] = React.useState("");
  const [validFrom, setValidFrom] = React.useState(new Date().toISOString().slice(0, 10));

  const { data: rates = [] } = useQuery<Rate[]>({
    queryKey: ["mileage-rates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/mileage-rates");
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/mileage-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerKm: parseFloat(rate.replace(",", ".")), validFrom }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
    },
    onSuccess: () => {
      toast.success("Tarifa guardada");
      setRate("");
      queryClient.invalidateQueries({ queryKey: ["mileage-rates"] });
      queryClient.invalidateQueries({ queryKey: ["mileage-rate"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date();
  const current = rates.find((r) => new Date(r.validFrom) <= today);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link href="/admin/users" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          Usuarios
        </Link>
        <Link href="/admin/cities" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          Catálogo de ciudades
        </Link>
        <Link href="/admin/reimbursements" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          Reembolsos
        </Link>
      </div>

      <section className="bg-white border rounded-lg p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Tarifa de kilometraje</h2>
          <p className="text-sm text-muted-foreground">
            Vigente hoy:{" "}
            <strong>{(current?.ratePerKm ?? DEFAULT_RATE_PER_KM).toFixed(2)} €/km</strong>
            {!current && " (valor por defecto, Orden HFP/792/2023)"}. Cada gasto guarda la
            tarifa con la que se registró: cambiarla no afecta a gastos anteriores.
          </p>
        </div>

        <form
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="rate">Nueva tarifa (€/km)</Label>
            <Input
              id="rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0,26"
            />
          </div>
          <div>
            <Label htmlFor="validFrom">Vigente desde</Label>
            <Input
              id="validFrom"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!rate || create.isPending}>
            Guardar tarifa
          </Button>
        </form>

        {rates.length > 0 && (
          <ul className="text-sm divide-y">
            {rates.map((r) => (
              <li key={r.id} className="py-2 flex justify-between">
                <span>Desde {formatDate(r.validFrom)}</span>
                <span>{r.ratePerKm.toFixed(2)} €/km</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
