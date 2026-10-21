"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Trip } from "@/types";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY);
}

/** Fecha del último billete subido (o null). */
export function lastTicketUpload(trip: Trip): Date | null {
  const dates = (trip.documents ?? [])
    .filter((d) => d.type === "BILLETE" && d.createdAt)
    .map((d) => new Date(d.createdAt!).getTime());
  return dates.length ? new Date(Math.max(...dates)) : null;
}

/**
 * Fase 3: estado del hotel y de los billetes de un viaje (solo ADMIN).
 * Sin pedir → (clic) Pedido el X, hace N días → Confirmado (al subir la
 * reserva, o a mano). Los botones no disparan el enlace de la tarjeta.
 */
export function HotelStatus({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (body: { requested?: boolean; confirmed?: boolean }) => {
      const res = await fetch(`/api/admin/trips/${trip.id}/hotel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTrips"] });
      queryClient.invalidateQueries({ queryKey: ["adminTrip", trip.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const ticket = lastTicketUpload(trip);
  const { hotelRequestedAt: requested, hotelConfirmedAt: confirmed } = trip;

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={ticket ? "default" : "outline"}>
        {ticket ? `✓ Billete (${formatDate(ticket)})` : "✗ Billete"}
      </Badge>

      {confirmed ? (
        <Badge className="bg-green-100 text-green-800">
          ✓ Hotel confirmado {formatDate(confirmed)}
        </Badge>
      ) : requested ? (
        <>
          <Badge className="bg-amber-100 text-amber-800">
            Hotel pedido {formatDate(requested)}
            {` · hace ${daysAgo(requested)} día${daysAgo(requested) === 1 ? "" : "s"}`}
          </Badge>
          {!compact && (
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={stop(() => update.mutate({ confirmed: true }))}
            >
              Marcar confirmado
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={update.isPending}
            onClick={stop(() => update.mutate({ requested: false }))}
          >
            Deshacer
          </Button>
        </>
      ) : (
        <>
          <Badge variant="outline" className="border-red-300 text-red-700">
            ✗ Hotel sin pedir
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={stop(() => update.mutate({ requested: true }))}
          >
            Marcar pedido
          </Button>
        </>
      )}
    </div>
  );
}
