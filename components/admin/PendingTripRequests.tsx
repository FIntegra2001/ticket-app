"use client";

import { useState } from "react";
import {
  usePendingTrips,
  useUpdateTrip,
  useUpdateTripStatus,
} from "@/hooks/useAdminTrips";
import type { CreateTripDto, Trip } from "@/types";
import TripForm from "@/components/forms/TripForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { AlertCircle, Check, Pencil, X } from "lucide-react";

/**
 * 🆕 Solicitudes de viaje pendientes de aprobación.
 *
 * Es lo primero que ve el admin al entrar al panel. Desde aquí puede completar
 * lo que falte (nº de factura interno, usuarios asignados, fechas) y aprobar o
 * rechazar. Aprobar es lo que desbloquea la carga de gastos para el usuario.
 *
 * Si no hay solicitudes, el componente no pinta nada.
 */
export default function PendingTripRequests() {
  const { data, isLoading } = usePendingTrips();
  const updateStatus = useUpdateTripStatus();
  const updateTrip = useUpdateTrip();

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const pending = data?.trips ?? [];

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (pending.length === 0) return null;

  const handleSubmit = (formData: CreateTripDto) => {
    if (!editingTrip) return;
    updateTrip.mutate(
      {
        tripId: editingTrip.id,
        data: formData,
      },
      { onSuccess: () => setEditingTrip(null) },
    );
  };

  return (
    <>
      <Card className="border-2 border-amber-300 bg-amber-50/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Solicitudes pendientes de aprobación ({pending.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hasta que apruebes una solicitud, el usuario no puede cargar gastos.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {pending.map((trip) => {
            const solicitante =
              trip.requestedBy?.name ??
              trip.requestedBy?.email ??
              trip.assignedUsers?.[0]?.user?.name ??
              "Usuario";

            return (
              <div
                key={trip.id}
                className="flex flex-col gap-3 rounded-lg border bg-background p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold truncate">
                    {trip.city}
                    {trip.project ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {trip.project}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    👤 {solicitante} · 📅 {formatDate(trip.startDate)} —{" "}
                    {formatDate(trip.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Solicitado el {formatDate(trip.createdAt)}
                    {trip.numberInvoice ? (
                      <> · Nº factura: {trip.numberInvoice}</>
                    ) : (
                      <> · ⚠️ sin nº de factura</>
                    )}
                  </p>
                  {trip.notes ? (
                    <p className="text-sm italic text-muted-foreground">
                      📝 {trip.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTrip(trip)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Revisar y completar
                  </Button>
                  <Button
                    size="sm"
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate({
                        tripId: trip.id,
                        status: "APROBADO",
                      })
                    }
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate({
                        tripId: trip.id,
                        status: "RECHAZADO",
                      })
                    }
                  >
                    <X className="mr-2 h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Formulario completo de admin: aquí se pone el nº de factura y se
          ajustan los usuarios asignados antes de aprobar. */}
      <Dialog
        open={!!editingTrip}
        onOpenChange={(open) => {
          if (!open) setEditingTrip(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar solicitud de viaje</DialogTitle>
          </DialogHeader>
          {editingTrip && (
            <TripForm
              initialData={editingTrip}
              onSubmit={handleSubmit}
              onCancel={() => setEditingTrip(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
