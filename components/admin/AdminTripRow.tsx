"use client";

import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HotelStatus } from "@/components/trips/HotelStatus";
import { EditTripButton } from "@/components/admin/EditTripButton";
import { CloseTripButton } from "@/components/admin/CloseTripButton";
import { useUpdateTripStatus } from "@/hooks/useAdminTrips";
import { isKmCategory } from "@/lib/mileage";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TripTab } from "@/lib/trip-tabs";
import type { Trip } from "@/types";

/**
 * Fila compacta de un viaje en el listado del ADMIN (sustituye a las tarjetas).
 * Toda la fila abre el detalle; lo que se muestra a la derecha depende de la
 * pestaña: acciones de aprobación, billete/hotel o estado de los tickets.
 */
export function AdminTripRow({ trip, tab, onEdit }: { trip: Trip; tab: TripTab; onEdit: (t: Trip) => void }) {
  const updateStatus = useUpdateTripStatus();
  const people = trip.assignedUsers?.map((a) => a.user?.name ?? a.user?.email).filter(Boolean).join(", ");
  const expenses = trip.expenses ?? [];
  const pendingTickets = expenses.filter((e) => !e.category || (!e.receiptUrl && !isKmCategory(e.category))).length;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div className="relative grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* El enlace cubre la fila por debajo; los botones quedan por encima, así
          los diálogos que abren (editar) no disparan la navegación */}
      <Link
        href={`/admin/trips/${trip.id}/expenses`}
        className="absolute inset-0"
        aria-label={`Abrir viaje ${trip.numberInvoice ?? ""} ${trip.city}`}
      />
      {/* Izquierda: qué viaje es */}
      <div className="min-w-0 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          {trip.numberInvoice ? (
            <span className="font-mono text-sm font-semibold">{trip.numberInvoice}</span>
          ) : (
            <span className="text-xs text-amber-700 font-medium">Sin nº</span>
          )}
          <span className="font-semibold break-words">{trip.city}</span>
          {trip.status === "RECHAZADO" && <Badge variant="destructive">Rechazado</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          {people ? ` · ${people}` : ""}
          {trip.project ? ` · ${trip.project}` : ""}
        </div>
      </div>

      {/* Derecha: lo relevante en cada pestaña */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 md:justify-end">
        {tab === "solicitudes" && (
          <>
            <span className="text-xs text-muted-foreground mr-1">
              Solicitado {formatDate(trip.createdAt)}
              {trip.requestedBy ? ` por ${trip.requestedBy.name ?? trip.requestedBy.email}` : ""}
            </span>
            <Button size="sm" variant="outline" onClick={stop(() => onEdit(trip))} aria-label="Editar">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              disabled={updateStatus.isPending}
              onClick={stop(() => updateStatus.mutate({ tripId: trip.id, status: "APROBADO" }))}
            >
              <Check className="w-4 h-4 mr-1" /> Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={updateStatus.isPending}
              onClick={stop(() => {
                if (confirm(`¿Rechazar el viaje a ${trip.city}?`)) updateStatus.mutate({ tripId: trip.id, status: "RECHAZADO" });
              })}
            >
              <X className="w-4 h-4 mr-1" /> Rechazar
            </Button>
          </>
        )}

        {tab === "proximos" && <HotelStatus trip={trip} />}
        {tab !== "solicitudes" && <EditTripButton trip={trip} compact />}

        {tab === "realizados" && trip.status !== "RECHAZADO" && (
          <>
            <span className="text-sm">
              {expenses.length} ticket{expenses.length === 1 ? "" : "s"} · {formatCurrency(trip.totalAmount)}
            </span>
            {expenses.length === 0 ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700">Sin tickets</Badge>
            ) : pendingTickets ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700">
                {pendingTickets} por revisar
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800">Completo</Badge>
            )}
            <CloseTripButton trip={trip} compact />
          </>
        )}
      </div>
    </div>
  );
}
