"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Trip } from "@/types";

/**
 * Cerrar un viaje (ADMIN): desde ese momento el viajero ya no puede añadir,
 * editar ni borrar sus gastos. Se puede reabrir si falta algo.
 */
export function CloseTripButton({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (closed: boolean) => {
      const res = await fetch(`/api/admin/trips/${trip.id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo guardar");
    },
    onSuccess: (_, closed) => {
      toast.success(closed ? "Viaje cerrado" : "Viaje reabierto");
      ["adminTrips", "admin-tasks"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      queryClient.invalidateQueries({ queryKey: ["adminTrip", trip.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (trip.status !== "APROBADO") return null;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  if (trip.closedAt) {
    return (
      <span className="flex items-center gap-2">
        <Badge className="bg-gray-800 text-white">
          <Lock className="w-3 h-3 mr-1" /> Cerrado {formatDate(trip.closedAt)}
        </Badge>
        {!compact && (
          <Button
            size="sm"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={stop(() => {
              if (confirm("¿Reabrir el viaje? El viajero podrá volver a modificar sus gastos.")) mutation.mutate(false);
            })}
          >
            <LockOpen className="w-4 h-4 mr-1" /> Reabrir
          </Button>
        )}
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={stop(() => {
        if (confirm(`¿Cerrar el viaje a ${trip.city}? El viajero ya no podrá añadir, editar ni borrar gastos.`))
          mutation.mutate(true);
      })}
    >
      <Lock className="w-4 h-4 mr-1" /> {compact ? "Cerrar" : "Cerrar viaje"}
    </Button>
  );
}
